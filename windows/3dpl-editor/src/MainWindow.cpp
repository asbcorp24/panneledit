#include "MainWindow.h"

#include "io/ProjectStorage.h"
#include "io/LegacyProjectImporter.h"
#include "export/PackageExporter.h"
#include "render/PanoramaViewport.h"
#include "render/MultiresGenerator.h"
#include "ui/ProjectOptionsDialog.h"
#include "ui/SceneObjectsDialog.h"

#include <QCloseEvent>
#include <QSpinBox>
#include <QColorDialog>
#include <QCheckBox>
#include <QColor>
#include <QComboBox>
#include <QDateTime>
#include <QTextEdit>
#include <QDialogButtonBox>
#include <QDialog>
#include <QDir>
#include <QDoubleSpinBox>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
#include <QEventLoop>
#include <QFormLayout>
#include <QGroupBox>
#include <QHeaderView>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QMenuBar>
#include <QMessageBox>
#include <QPushButton>
#include <QProgressDialog>
#include <QRegularExpression>
#include <QScrollArea>
#include <QSettings>
#include <QSplitter>
#include <QStackedWidget>
#include <QStatusBar>
#include <QTableWidget>
#include <QTimer>
#include <QToolBar>
#include <QUndoCommand>
#include <QVBoxLayout>
#include <QUrl>
#include <QVideoSink>
#include <QVideoFrame>
#include <QMediaPlayer>
#include <QApplication>
#include <QAudioOutput>

#include <functional>

namespace {

class LambdaCommand final : public QUndoCommand {
public:
    LambdaCommand(
        QString text,
        std::function<void()> redoFn,
        std::function<void()> undoFn,
        QUndoCommand* parent = nullptr
    )
        : QUndoCommand(std::move(text), parent)
        , m_redo(std::move(redoFn))
        , m_undo(std::move(undoFn))
    {}

    void redo() override { if (m_redo) m_redo(); }
    void undo() override { if (m_undo) m_undo(); }

private:
    std::function<void()> m_redo;
    std::function<void()> m_undo;
};

QWidget* panelContainer(const QString& title, QWidget* body, QWidget* parent = nullptr) {
    auto* panel = new QWidget(parent);
    auto* layout = new QVBoxLayout(panel);
    layout->setContentsMargins(12, 12, 12, 12);
    layout->setSpacing(10);

    auto* heading = new QLabel(title);
    QFont font = heading->font();
    font.setBold(true);
    font.setPointSize(font.pointSize() + 2);
    heading->setFont(font);

    layout->addWidget(heading);
    layout->addWidget(body, 1);
    return panel;
}

QPushButton* smallButton(const QString& text) {
    auto* button = new QPushButton(text);
    button->setMinimumHeight(30);
    return button;
}

QString objectImageFilter() {
    return "Изображения (*.jpg *.jpeg *.png *.webp *.bmp)";
}

} // namespace

MainWindow::MainWindow(QWidget* parent)
    : QMainWindow(parent)
{
    resize(1600, 950);
    setMinimumSize(1100, 700);
    setWindowTitle("3DPL Editor — Native C++");

    setStyleSheet(R"(
        QMainWindow, QWidget { background:#090d16; color:#e8edf7; }
        QMenuBar, QMenu, QToolBar { background:#101725; color:#e8edf7; }
        QToolBar { border-bottom:1px solid #263149; spacing:6px; padding:6px; }
        QPushButton {
            background:#18243a; border:1px solid #33415e; border-radius:7px;
            padding:6px 10px; color:#eef4ff;
        }
        QPushButton:hover { background:#233552; border-color:#5b739e; }
        QPushButton:pressed { background:#101a2b; }
        QPushButton:disabled { color:#68738a; background:#121927; }
        QLineEdit, QComboBox, QDoubleSpinBox, QSpinBox {
            background:#0f1726; border:1px solid #303c56; border-radius:6px;
            padding:5px 7px; selection-background-color:#467ee7;
        }
        QListWidget, QTableWidget {
            background:#0d1422; border:1px solid #263149; border-radius:7px;
            alternate-background-color:#111b2d;
        }
        QListWidget::item { padding:9px; border-bottom:1px solid #1c2639; }
        QListWidget::item:selected { background:#1f365b; }
        QHeaderView::section { background:#131d2f; padding:6px; border:0; }
        QSplitter::handle { background:#202a3e; width:1px; }
        QGroupBox {
            border:1px solid #28344c; border-radius:8px; margin-top:10px; padding-top:10px;
        }
        QGroupBox::title { subcontrol-origin:margin; left:10px; padding:0 5px; color:#77e6d8; }
        QScrollArea { border:0; }
    )");

    buildUi();
    buildMenus();

    m_audioOutput = new QAudioOutput(this);
    m_mediaPlayer = new QMediaPlayer(this);
    m_videoSink = new QVideoSink(this);
    m_mediaPlayer->setAudioOutput(m_audioOutput);
    m_mediaPlayer->setVideoOutput(m_videoSink);

    connect(m_videoSink, &QVideoSink::videoFrameChanged, this, [this](const QVideoFrame& frame) {
        const Scene* scene = currentScene();
        if (!scene || scene->type != SceneType::Xr || scene->xrKind != "video") return;
        const QImage image = frame.toImage();
        if (!image.isNull()) m_viewport->setVideoFrame(image, scene->projection);
    });

    m_autosaveTimer = new QTimer(this);
    m_autosaveTimer->setSingleShot(true);
    m_autosaveTimer->setInterval(900);
    connect(m_autosaveTimer, &QTimer::timeout, this, [this] {
        if (m_dirty && !m_projectDir.isEmpty()) saveCurrent(false);
    });

    connect(&m_undoStack, &QUndoStack::cleanChanged, this, [this](bool clean) {
        if (!m_refreshing) {
            m_dirty = !clean;
            statusBar()->showMessage(clean ? "Сохранено" : "Есть изменения", 1500);
        }
    });

    QSettings settings;
    const QString lastProject = settings.value("lastProject").toString();
    if (!lastProject.isEmpty() && QFileInfo::exists(QDir(lastProject).filePath("project.json"))) {
        QString error;
        if (ProjectStorage::loadProject(lastProject, m_project, &error)) {
            m_projectDir = lastProject;
            m_currentSceneId = m_project.firstSceneId;
            m_undoStack.clear();
            m_undoStack.setClean();
            refreshAll();
        }
    } else {
        refreshAll();
    }
}

void MainWindow::buildUi() {
    auto* toolbar = addToolBar("Основная");
    toolbar->setMovable(false);

    auto* newAction = toolbar->addAction("Новый");
    auto* openAction = toolbar->addAction("Открыть");
    auto* saveAction = toolbar->addAction("Сохранить");
    auto* exportXrAction = toolbar->addAction("Player ZIP");
    toolbar->addSeparator();
    auto* addPano = toolbar->addAction("+ Панорама");
    auto* addObject = toolbar->addAction("+ Object360");
    auto* addStlAction = toolbar->addAction("+ STL");
    auto* addXrAction = toolbar->addAction("+ XR");
    toolbar->addSeparator();
    auto* undoAction = m_undoStack.createUndoAction(this, "Отмена");
    auto* redoAction = m_undoStack.createRedoAction(this, "Повтор");
    toolbar->addAction(undoAction);
    toolbar->addAction(redoAction);

    connect(newAction, &QAction::triggered, this, &MainWindow::newProject);
    connect(openAction, &QAction::triggered, this, &MainWindow::openProject);
    connect(saveAction, &QAction::triggered, this, &MainWindow::saveProject);
    connect(exportXrAction, &QAction::triggered, this, &MainWindow::exportOpenXrPackage);
    connect(addPano, &QAction::triggered, this, &MainWindow::addPanorama);
    connect(addObject, &QAction::triggered, this, &MainWindow::addObject360);
    connect(addStlAction, &QAction::triggered, this, &MainWindow::addStl);
    connect(addXrAction, &QAction::triggered, this, &MainWindow::addXr);

    auto* splitter = new QSplitter(Qt::Horizontal, this);
    splitter->setChildrenCollapsible(false);

    splitter->addWidget(buildLeftPanel());

    auto* center = new QWidget;
    auto* centerLayout = new QVBoxLayout(center);
    centerLayout->setContentsMargins(0, 0, 0, 0);
    centerLayout->setSpacing(0);

    auto* viewHeader = new QWidget;
    auto* viewHeaderLayout = new QHBoxLayout(viewHeader);
    viewHeaderLayout->setContentsMargins(10, 7, 10, 7);

    m_sceneTypeBadge = new QLabel("НЕТ СЦЕНЫ");
    m_sceneTypeBadge->setStyleSheet(
        "QLabel{background:#192339;color:#77e6d8;border-radius:6px;padding:5px 9px;font-weight:700;}"
    );
    viewHeaderLayout->addWidget(m_sceneTypeBadge);

    auto* hint = new QLabel("Drag — вращение  •  Wheel — FOV  •  Double click — hotspot");
    hint->setStyleSheet("color:#7f8da8;");
    viewHeaderLayout->addStretch();
    viewHeaderLayout->addWidget(hint);

    centerLayout->addWidget(viewHeader);

    m_viewport = new PanoramaViewport;
    centerLayout->addWidget(m_viewport, 1);

    m_status = new QLabel("yaw 0.0° · pitch 0.0° · FOV 100°");
    m_status->setContentsMargins(10, 5, 10, 5);
    m_status->setStyleSheet("background:#0f1726;color:#9eb0cb;");
    centerLayout->addWidget(m_status);

    connect(m_viewport, &PanoramaViewport::viewChanged, this, [this](double yaw, double pitch, double fov) {
        m_status->setText(
            QString("yaw %1° · pitch %2° · FOV %3°")
                .arg(yaw, 0, 'f', 1)
                .arg(pitch, 0, 'f', 1)
                .arg(fov, 0, 'f', 0)
        );
    });
    connect(m_viewport, &PanoramaViewport::hotspotRequested, this, &MainWindow::addHotspot);
    connect(m_viewport, &PanoramaViewport::objectHotspotRequested, this, &MainWindow::addObjectHotspot);
    connect(m_viewport, &PanoramaViewport::objectFrameChanged, this, [this](int sector, int row) {
        m_status->setText(QString("Object360 · сектор %1 · ряд %2").arg(sector).arg(row));
    });
    connect(m_viewport, &PanoramaViewport::stlLoadFailed, this, [this](const QString& message) {
        statusBar()->showMessage("STL: " + message, 4000);
    });
    connect(m_viewport, &PanoramaViewport::hotspotSelected, this, [this](int index) {
        if (!m_hotspotTable || index < 0 || index >= m_hotspotTable->rowCount()) return;
        m_hotspotTable->selectRow(index);
        m_hotspotTable->scrollToItem(m_hotspotTable->item(index, 0));
    });
    connect(m_viewport, &PanoramaViewport::imageLoadFailed, this, [this](const QString& message) {
        statusBar()->showMessage(message, 4000);
    });

    splitter->addWidget(center);
    splitter->addWidget(buildRightPanel());
    splitter->setSizes({285, 1000, 330});

    setCentralWidget(splitter);
    statusBar()->showMessage("Готово");
}

void MainWindow::buildMenus() {
    auto* fileMenu = menuBar()->addMenu("Файл");
    fileMenu->addAction("Новый проект", this, &MainWindow::newProject, QKeySequence::New);
    fileMenu->addAction("Открыть проект", this, &MainWindow::openProject, QKeySequence::Open);
    fileMenu->addAction("Импорт старого Web JSON…", this, &MainWindow::importLegacyProject);
    fileMenu->addAction("Сохранить", this, &MainWindow::saveProject, QKeySequence::Save);
    fileMenu->addAction("Сохранить как…", this, &MainWindow::saveProjectAs, QKeySequence::SaveAs);
    fileMenu->addSeparator();
    fileMenu->addAction("Настройки тура…", this, &MainWindow::editProjectOptions);
    fileMenu->addAction("Экспорт Player ZIP (Android + OpenXR)", this, &MainWindow::exportOpenXrPackage);
    fileMenu->addSeparator();
    fileMenu->addAction("Выход", this, &QWidget::close);

    auto* editMenu = menuBar()->addMenu("Правка");
    editMenu->addAction(m_undoStack.createUndoAction(this, "Отмена"));
    editMenu->addAction(m_undoStack.createRedoAction(this, "Повтор"));

    auto* sceneMenu = menuBar()->addMenu("Сцена");
    sceneMenu->addAction("Добавить панораму", this, &MainWindow::addPanorama);
    sceneMenu->addAction("Добавить Object360", this, &MainWindow::addObject360);
    sceneMenu->addAction("Добавить STL", this, &MainWindow::addStl);
    sceneMenu->addAction("Добавить XR", this, &MainWindow::addXr);
    sceneMenu->addSeparator();
    sceneMenu->addAction("Текст и медиа сцены…", this, &MainWindow::editSceneObjects);
    sceneMenu->addSeparator();
    sceneMenu->addAction("Удалить текущую сцену", this, &MainWindow::deleteCurrentScene, QKeySequence::Delete);
}

QWidget* MainWindow::buildLeftPanel() {
    auto* body = new QWidget;
    auto* layout = new QVBoxLayout(body);
    layout->setContentsMargins(0, 0, 0, 0);

    auto* addRow = new QHBoxLayout;
    auto* addPano = smallButton("+ 360");
    auto* addObject = smallButton("+ Obj");
    auto* addStlButton = smallButton("+ STL");
    auto* addXrButton = smallButton("+ XR");
    addRow->addWidget(addPano);
    addRow->addWidget(addObject);
    addRow->addWidget(addStlButton);
    addRow->addWidget(addXrButton);

    connect(addPano, &QPushButton::clicked, this, &MainWindow::addPanorama);
    connect(addObject, &QPushButton::clicked, this, &MainWindow::addObject360);
    connect(addStlButton, &QPushButton::clicked, this, &MainWindow::addStl);
    connect(addXrButton, &QPushButton::clicked, this, &MainWindow::addXr);

    layout->addLayout(addRow);

    m_sceneList = new QListWidget;
    m_sceneList->setAlternatingRowColors(true);
    layout->addWidget(m_sceneList, 1);

    connect(m_sceneList, &QListWidget::currentItemChanged, this, [this](QListWidgetItem* current) {
        if (!current || m_refreshing) return;
        selectScene(current->data(Qt::UserRole).toString());
    });

    auto* remove = smallButton("Удалить сцену");
    connect(remove, &QPushButton::clicked, this, &MainWindow::deleteCurrentScene);
    layout->addWidget(remove);

    auto* panel = panelContainer("Сцены", body);
    panel->setMinimumWidth(250);
    panel->setMaximumWidth(420);
    return panel;
}

QWidget* MainWindow::buildRightPanel() {
    m_rightStack = new QStackedWidget;
    m_rightStack->addWidget(buildProjectPage());
    m_rightStack->addWidget(buildScenePage());

    auto* panel = panelContainer("Свойства", m_rightStack);
    panel->setMinimumWidth(300);
    panel->setMaximumWidth(460);
    return panel;
}

QWidget* MainWindow::buildProjectPage() {
    auto* root = new QWidget;
    auto* layout = new QVBoxLayout(root);

    auto* group = new QGroupBox("Проект");
    auto* form = new QFormLayout(group);

    m_projectTitle = new QLineEdit;
    m_firstScene = new QComboBox;
    form->addRow("Название", m_projectTitle);
    form->addRow("Стартовая сцена", m_firstScene);

    layout->addWidget(group);

    auto* audioGroup = new QGroupBox("Музыка тура");
    auto* audioLayout = new QVBoxLayout(audioGroup);
    m_projectMusicName = new QLabel("Не выбрана");
    m_projectMusicName->setWordWrap(true);
    audioLayout->addWidget(m_projectMusicName);

    auto* audioButtons = new QHBoxLayout;
    auto* chooseMusic = smallButton("Выбрать");
    auto* removeMusic = smallButton("Убрать");
    audioButtons->addWidget(chooseMusic);
    audioButtons->addWidget(removeMusic);
    audioLayout->addLayout(audioButtons);

    auto* audioForm = new QFormLayout;
    m_projectMusicVolume = new QSpinBox;
    m_projectMusicVolume->setRange(0, 100);
    m_projectMusicVolume->setSuffix("%");
    m_projectMusicLoop = new QCheckBox("Повторять");
    audioForm->addRow("Громкость", m_projectMusicVolume);
    audioForm->addRow("", m_projectMusicLoop);
    audioLayout->addLayout(audioForm);

    layout->addWidget(audioGroup);
    layout->addStretch();

    connect(chooseMusic, &QPushButton::clicked, this, &MainWindow::chooseProjectMusic);
    connect(removeMusic, &QPushButton::clicked, this, &MainWindow::removeProjectMusic);
    connect(m_projectMusicVolume, qOverload<int>(&QSpinBox::valueChanged), this, [this](int value) {
        if (m_refreshing) return;
        m_project.musicVolume = value;
        markDirty();
    });
    connect(m_projectMusicLoop, &QCheckBox::toggled, this, [this](bool checked) {
        if (m_refreshing) return;
        m_project.musicLoop = checked;
        markDirty();
    });

    connect(m_projectTitle, &QLineEdit::editingFinished, this, [this] {
        if (!m_refreshing) setProjectTitle(m_projectTitle->text());
    });

    connect(m_firstScene, &QComboBox::currentIndexChanged, this, [this](int index) {
        if (m_refreshing || index < 0) return;
        const QString next = m_firstScene->itemData(index).toString();
        if (next == m_project.firstSceneId) return;
        const QString before = m_project.firstSceneId;
        m_undoStack.push(new LambdaCommand(
            "Стартовая сцена",
            [this, next] { m_project.firstSceneId = next; markDirty(); refreshProjectControls(); },
            [this, before] { m_project.firstSceneId = before; markDirty(); refreshProjectControls(); }
        ));
    });

    return root;
}

QWidget* MainWindow::buildScenePage() {
    auto* scroll = new QScrollArea;
    scroll->setWidgetResizable(true);

    auto* root = new QWidget;
    auto* layout = new QVBoxLayout(root);

    auto* general = new QGroupBox("Сцена");
    auto* form = new QFormLayout(general);

    m_sceneTitle = new QLineEdit;
    m_sceneId = new QLineEdit;
    m_sceneId->setReadOnly(true);
    m_sceneYaw = new QDoubleSpinBox;
    m_sceneYaw->setRange(-360.0, 360.0);
    m_sceneYaw->setDecimals(1);
    m_scenePitch = new QDoubleSpinBox;
    m_scenePitch->setRange(-89.0, 89.0);
    m_scenePitch->setDecimals(1);
    m_sceneFov = new QDoubleSpinBox;
    m_sceneFov->setRange(30.0, 120.0);
    m_sceneFov->setDecimals(1);
    m_sceneProjection = new QComboBox;
    m_sceneProjection->addItems({"360", "180", "360_LR", "180_LR", "360_TB", "180_TB"});
    m_sceneSource = new QLabel;
    m_sceneSource->setWordWrap(true);
    m_sceneSource->setTextInteractionFlags(Qt::TextSelectableByMouse);

    form->addRow("Название", m_sceneTitle);
    form->addRow("ID", m_sceneId);
    form->addRow("Yaw", m_sceneYaw);
    form->addRow("Pitch", m_scenePitch);
    form->addRow("FOV", m_sceneFov);
    form->addRow("Проекция", m_sceneProjection);
    form->addRow("Файл", m_sceneSource);
    layout->addWidget(general);

    m_panoramaOptions = new QGroupBox("Панорама / Multires");
    auto* panoForm = new QFormLayout(m_panoramaOptions);
    m_multiresTileSize = new QComboBox;
    m_multiresTileSize->addItem("256 px", 256);
    m_multiresTileSize->addItem("512 px", 512);
    m_multiresTileSize->addItem("1024 px", 1024);
    m_multiresTileSize->setCurrentIndex(1);

    m_multiresQuality = new QSpinBox;
    m_multiresQuality->setRange(45, 100);
    m_multiresQuality->setValue(82);
    m_multiresQuality->setSuffix("%");

    m_multiresMaxCube = new QComboBox;
    m_multiresMaxCube->addItem("2048", 2048);
    m_multiresMaxCube->addItem("4096", 4096);
    m_multiresMaxCube->addItem("8192", 8192);
    m_multiresMaxCube->setCurrentIndex(1);

    m_generateMultires = smallButton("Создать / обновить Multires");
    panoForm->addRow("Тайл", m_multiresTileSize);
    panoForm->addRow("JPEG", m_multiresQuality);
    panoForm->addRow("Макс. грань", m_multiresMaxCube);
    panoForm->addRow("", m_generateMultires);
    layout->addWidget(m_panoramaOptions);

    m_objectOptions = new QGroupBox("Object360");
    auto* objectForm = new QFormLayout(m_objectOptions);
    m_objectStartSector = new QSpinBox;
    m_objectStartSector->setRange(0, 100000);
    m_objectStartRow = new QSpinBox;
    m_objectStartRow->setRange(0, 10000);
    objectForm->addRow("Стартовый сектор", m_objectStartSector);
    objectForm->addRow("Стартовый ряд", m_objectStartRow);
    layout->addWidget(m_objectOptions);

    m_stlOptions = new QGroupBox("STL 3D");
    auto* stlForm = new QFormLayout(m_stlOptions);
    m_stlZoom = new QDoubleSpinBox;
    m_stlZoom->setRange(0.35, 5.0);
    m_stlZoom->setSingleStep(0.1);
    m_stlZoom->setDecimals(2);
    m_stlWireframe = new QCheckBox("Показывать сетку");
    m_stlColorButton = smallButton("Цвет модели");
    stlForm->addRow("Zoom", m_stlZoom);
    stlForm->addRow("", m_stlWireframe);
    stlForm->addRow("Цвет", m_stlColorButton);
    layout->addWidget(m_stlOptions);

    m_xrOptions = new QGroupBox("XR Media");
    auto* xrForm = new QFormLayout(m_xrOptions);
    m_sceneAutoplay = new QCheckBox("Автовоспроизведение / автовращение");
    m_sceneLoop = new QCheckBox("Повторять");
    m_xrVolume = new QSpinBox;
    m_xrVolume->setRange(0, 100);
    m_xrVolume->setSuffix("%");
    xrForm->addRow("", m_sceneAutoplay);
    xrForm->addRow("", m_sceneLoop);
    xrForm->addRow("Громкость", m_xrVolume);
    layout->addWidget(m_xrOptions);

    m_sceneAudioOptions = new QGroupBox("Аудио сцены");
    auto* sceneAudioLayout = new QVBoxLayout(m_sceneAudioOptions);

    auto* musicTitle = new QLabel("<b>Музыка сцены</b>");
    sceneAudioLayout->addWidget(musicTitle);
    m_sceneMusicName = new QLabel("Не выбрана");
    m_sceneMusicName->setWordWrap(true);
    sceneAudioLayout->addWidget(m_sceneMusicName);
    auto* musicButtons = new QHBoxLayout;
    auto* chooseSceneMusicButton = smallButton("Выбрать");
    auto* removeSceneMusicButton = smallButton("Убрать");
    musicButtons->addWidget(chooseSceneMusicButton);
    musicButtons->addWidget(removeSceneMusicButton);
    sceneAudioLayout->addLayout(musicButtons);

    auto* musicForm = new QFormLayout;
    m_sceneMusicVolume = new QSpinBox;
    m_sceneMusicVolume->setRange(0,100);
    m_sceneMusicVolume->setSuffix("%");
    m_sceneMusicLoop = new QCheckBox("Повторять");
    musicForm->addRow("Громкость", m_sceneMusicVolume);
    musicForm->addRow("", m_sceneMusicLoop);
    sceneAudioLayout->addLayout(musicForm);

    auto* narrationTitle = new QLabel("<b>Озвучка сцены</b>");
    sceneAudioLayout->addWidget(narrationTitle);
    m_sceneNarrationName = new QLabel("Не выбрана");
    m_sceneNarrationName->setWordWrap(true);
    sceneAudioLayout->addWidget(m_sceneNarrationName);
    auto* narrationButtons = new QHBoxLayout;
    auto* chooseNarrationButton = smallButton("Выбрать");
    auto* removeNarrationButton = smallButton("Убрать");
    narrationButtons->addWidget(chooseNarrationButton);
    narrationButtons->addWidget(removeNarrationButton);
    sceneAudioLayout->addLayout(narrationButtons);

    auto* narrationForm = new QFormLayout;
    m_sceneNarrationVolume = new QSpinBox;
    m_sceneNarrationVolume->setRange(0,100);
    m_sceneNarrationVolume->setSuffix("%");
    narrationForm->addRow("Громкость", m_sceneNarrationVolume);
    sceneAudioLayout->addLayout(narrationForm);

    layout->addWidget(m_sceneAudioOptions);

    connect(chooseSceneMusicButton, &QPushButton::clicked, this, &MainWindow::chooseSceneMusic);
    connect(removeSceneMusicButton, &QPushButton::clicked, this, &MainWindow::removeSceneMusic);
    connect(chooseNarrationButton, &QPushButton::clicked, this, &MainWindow::chooseSceneNarration);
    connect(removeNarrationButton, &QPushButton::clicked, this, &MainWindow::removeSceneNarration);
    connect(m_sceneMusicVolume, qOverload<int>(&QSpinBox::valueChanged), this, [this](int value) {
        if (m_refreshing) return;
        if (auto* scene = currentScene()) { scene->musicVolume = value; markDirty(); }
    });
    connect(m_sceneMusicLoop, &QCheckBox::toggled, this, [this](bool checked) {
        if (m_refreshing) return;
        if (auto* scene = currentScene()) { scene->musicLoop = checked; markDirty(); }
    });
    connect(m_sceneNarrationVolume, qOverload<int>(&QSpinBox::valueChanged), this, [this](int value) {
        if (m_refreshing) return;
        if (auto* scene = currentScene()) { scene->narrationVolume = value; markDirty(); }
    });

    auto* hotspotGroup = new QGroupBox("Hotspot-ы");
    auto* hotspotLayout = new QVBoxLayout(hotspotGroup);

    m_hotspotTable = new QTableWidget(0, 4);
    m_hotspotTable->setHorizontalHeaderLabels({"Тип", "Текст", "Yaw", "Pitch"});
    m_hotspotTable->horizontalHeader()->setSectionResizeMode(1, QHeaderView::Stretch);
    m_hotspotTable->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_hotspotTable->setSelectionMode(QAbstractItemView::SingleSelection);
    hotspotLayout->addWidget(m_hotspotTable);

    auto* hsRow = new QHBoxLayout;
    auto* addCenter = smallButton("+ В центр");
    auto* editHotspot = smallButton("Изменить");
    m_deleteHotspot = smallButton("Удалить");
    hsRow->addWidget(addCenter);
    hsRow->addWidget(editHotspot);
    hsRow->addWidget(m_deleteHotspot);
    hotspotLayout->addLayout(hsRow);

    connect(addCenter, &QPushButton::clicked, this, [this] {
        addHotspot(m_viewport->yaw(), m_viewport->pitch());
    });
    connect(editHotspot, &QPushButton::clicked, this, &MainWindow::editSelectedHotspot);
    connect(m_hotspotTable, &QTableWidget::cellDoubleClicked, this, [this](int, int) {
        editSelectedHotspot();
    });
    connect(m_deleteHotspot, &QPushButton::clicked, this, &MainWindow::deleteSelectedHotspot);

    layout->addWidget(hotspotGroup);
    layout->addStretch();
    scroll->setWidget(root);

    connect(m_sceneTitle, &QLineEdit::editingFinished, this, [this] {
        if (!m_refreshing) setSceneTitle(m_sceneTitle->text());
    });
    connect(m_sceneYaw, &QDoubleSpinBox::editingFinished, this, [this] {
        if (!m_refreshing) setSceneYaw(m_sceneYaw->value());
    });
    connect(m_scenePitch, &QDoubleSpinBox::editingFinished, this, [this] {
        if (!m_refreshing) setScenePitch(m_scenePitch->value());
    });
    connect(m_sceneFov, &QDoubleSpinBox::editingFinished, this, [this] {
        if (!m_refreshing) setSceneFov(m_sceneFov->value());
    });
    connect(m_sceneProjection, &QComboBox::currentTextChanged, this, [this](const QString& value) {
        if (!m_refreshing) setSceneProjection(value);
    });

    connect(m_generateMultires, &QPushButton::clicked, this, &MainWindow::generateCurrentMultires);

    connect(m_objectStartSector, qOverload<int>(&QSpinBox::valueChanged), this, [this](int value) {
        if (m_refreshing) return;
        if (auto* scene = currentScene(); scene && scene->type == SceneType::Object360) {
            scene->startSector = value;
            markDirty();
        }
    });
    connect(m_objectStartRow, qOverload<int>(&QSpinBox::valueChanged), this, [this](int value) {
        if (m_refreshing) return;
        if (auto* scene = currentScene(); scene && scene->type == SceneType::Object360) {
            scene->startRow = value;
            markDirty();
        }
    });

    connect(m_stlZoom, qOverload<double>(&QDoubleSpinBox::valueChanged), this, [this](double value) {
        if (m_refreshing) return;
        if (auto* scene = currentScene(); scene && scene->type == SceneType::Stl) {
            scene->zoom = value;
            markDirty();
            m_viewport->setStlStyle(QColor(scene->color), scene->wireframe, scene->zoom);
        }
    });
    connect(m_stlWireframe, &QCheckBox::toggled, this, [this](bool checked) {
        if (m_refreshing) return;
        if (auto* scene = currentScene(); scene && scene->type == SceneType::Stl) {
            scene->wireframe = checked;
            markDirty();
            m_viewport->setStlStyle(QColor(scene->color), scene->wireframe, scene->zoom);
        }
    });
    connect(m_stlColorButton, &QPushButton::clicked, this, [this] {
        auto* scene = currentScene();
        if (!scene || scene->type != SceneType::Stl) return;
        const QColor color = QColorDialog::getColor(QColor(scene->color), this, "Цвет STL");
        if (!color.isValid()) return;
        scene->color = color.name(QColor::HexRgb);
        markDirty();
        refreshSceneControls();
        m_viewport->setStlStyle(color, scene->wireframe, scene->zoom);
    });

    connect(m_sceneAutoplay, &QCheckBox::toggled, this, [this](bool checked) {
        if (m_refreshing) return;
        if (auto* scene = currentScene()) {
            scene->autoplay = checked;
            markDirty();
        }
    });
    connect(m_sceneLoop, &QCheckBox::toggled, this, [this](bool checked) {
        if (m_refreshing) return;
        if (auto* scene = currentScene()) {
            scene->loop = checked;
            markDirty();
            if (scene->type == SceneType::Xr && scene->xrKind == "video" && m_mediaPlayer)
                m_mediaPlayer->setLoops(checked ? QMediaPlayer::Infinite : QMediaPlayer::Once);
        }
    });
    connect(m_xrVolume, qOverload<int>(&QSpinBox::valueChanged), this, [this](int value) {
        if (m_refreshing) return;
        if (auto* scene = currentScene()) {
            scene->volume = value;
            markDirty();
            if (m_audioOutput) m_audioOutput->setVolume(value / 100.0);
        }
    });

    return scroll;
}

void MainWindow::newProject() {
    if (m_dirty) {
        const auto answer = QMessageBox::question(
            this,
            "Новый проект",
            "Текущий проект изменён. Сохранить?",
            QMessageBox::Save | QMessageBox::Discard | QMessageBox::Cancel
        );
        if (answer == QMessageBox::Cancel) return;
        if (answer == QMessageBox::Save && !saveCurrent()) return;
    }

    const QString directory = QFileDialog::getExistingDirectory(this, "Папка нового проекта");
    if (directory.isEmpty()) return;

    QString projectDir = directory;
    if (!projectDir.endsWith(".3dpl", Qt::CaseInsensitive)) {
        projectDir = QDir(directory).filePath("NewTour.3dpl");
    }

    QString error;
    if (!ProjectStorage::createProject(projectDir, m_project, &error)) {
        QMessageBox::critical(this, "Ошибка", error);
        return;
    }

    m_projectDir = projectDir;
    m_currentSceneId.clear();
    m_undoStack.clear();
    m_undoStack.setClean();
    m_dirty = false;

    QSettings().setValue("lastProject", m_projectDir);
    refreshAll();
}

void MainWindow::openProject() {
    const QString directory = QFileDialog::getExistingDirectory(this, "Открыть .3dpl проект");
    if (directory.isEmpty()) return;

    QString error;
    Project loaded;
    if (!ProjectStorage::loadProject(directory, loaded, &error)) {
        QMessageBox::critical(this, "Ошибка", error);
        return;
    }

    m_project = std::move(loaded);
    m_projectDir = directory;
    m_currentSceneId = m_project.firstSceneId;
    if (m_currentSceneId.isEmpty() && !m_project.scenes.isEmpty())
        m_currentSceneId = m_project.scenes.first().id;

    m_undoStack.clear();
    m_undoStack.setClean();
    m_dirty = false;
    QSettings().setValue("lastProject", m_projectDir);
    refreshAll();
}

void MainWindow::importLegacyProject() {
    const QString jsonFile = QFileDialog::getOpenFileName(
        this,
        "Импорт старого веб-проекта",
        {},
        "XR Tour Project (*.xr-tour-project.json *.json)"
    );
    if (jsonFile.isEmpty()) return;

    const QString parent = QFileDialog::getExistingDirectory(
        this,
        "Куда создать .3dpl проект"
    );
    if (parent.isEmpty()) return;

    QString baseName = QFileInfo(jsonFile).completeBaseName();
    baseName.remove(".xr-tour-project", Qt::CaseInsensitive);
    baseName.replace(QRegularExpression("[^A-Za-z0-9А-Яа-я_-]+"), "_");
    if (baseName.isEmpty()) baseName = "ImportedTour";

    QString target = QDir(parent).filePath(baseName + ".3dpl");
    int suffix = 2;
    while (QFileInfo::exists(target)) {
        target = QDir(parent).filePath(
            baseName + "_" + QString::number(suffix++) + ".3dpl"
        );
    }

    QProgressDialog progress(
        "Перенос изображений, Object360, STL, XR и аудио…",
        QString(),
        0,
        0,
        this
    );
    progress.setWindowTitle("Импорт Web → C++");
    progress.setCancelButton(nullptr);
    progress.setWindowModality(Qt::WindowModal);
    progress.show();

    QApplication::setOverrideCursor(Qt::WaitCursor);

    Project imported;
    QString error;
    const bool ok = LegacyProjectImporter::importJson(
        jsonFile,
        target,
        imported,
        &error
    );

    QApplication::restoreOverrideCursor();
    progress.close();

    if (!ok) {
        QMessageBox::critical(this, "Импорт", error);
        return;
    }

    m_project = std::move(imported);
    m_projectDir = target;
    m_currentSceneId = m_project.firstSceneId;
    if (m_currentSceneId.isEmpty() && !m_project.scenes.isEmpty())
        m_currentSceneId = m_project.scenes.first().id;

    m_undoStack.clear();
    m_undoStack.setClean();
    m_dirty = false;
    QSettings().setValue("lastProject", m_projectDir);
    refreshAll();

    QMessageBox::information(
        this,
        "Импорт завершён",
        "Старый веб-проект перенесён в:\n" +
            QDir::toNativeSeparators(m_projectDir)
    );
}

void MainWindow::saveProject() {
    if (m_projectDir.isEmpty()) {
        saveProjectAs();
        return;
    }
    saveCurrent();
}

void MainWindow::saveProjectAs() {
    const QString directory = QFileDialog::getExistingDirectory(this, "Папка для проекта");
    if (directory.isEmpty()) return;

    QString target = directory;
    if (!target.endsWith(".3dpl", Qt::CaseInsensitive)) {
        target = QDir(directory).filePath("Tour.3dpl");
    }

    QString error;
    if (!ProjectStorage::ensureLayout(target, &error)) {
        QMessageBox::critical(this, "Ошибка", error);
        return;
    }

    m_projectDir = target;
    if (!saveCurrent()) return;
    QSettings().setValue("lastProject", m_projectDir);
    refreshAll();
}

bool MainWindow::saveCurrent(bool showErrors) {
    if (m_projectDir.isEmpty()) return false;

    QString error;
    if (!ProjectStorage::saveProject(m_projectDir, m_project, &error)) {
        if (showErrors) QMessageBox::critical(this, "Ошибка сохранения", error);
        return false;
    }

    m_dirty = false;
    m_undoStack.setClean();
    setWindowTitle("3DPL Editor — " + m_project.title);
    if (showErrors) statusBar()->showMessage("Проект сохранён", 1800);
    return true;
}

void MainWindow::generateCurrentMultires() {
    Scene* scene = currentScene();
    if (!scene || scene->type != SceneType::Panorama) return;
    if (m_projectDir.isEmpty() || scene->source.isEmpty()) return;

    const QString source = ProjectStorage::resolveAsset(m_projectDir, scene->source);
    if (source.isEmpty()) {
        QMessageBox::critical(this, "Multires", "Исходная панорама не найдена.");
        return;
    }

    MultiresGenerator::Options options;
    options.tileSize = m_multiresTileSize->currentData().toInt();
    options.jpegQuality = m_multiresQuality->value();
    options.maxCubeSize = m_multiresMaxCube->currentData().toInt();

    QProgressDialog progress("Подготовка cubemap…", QString(), 0, 100, this);
    progress.setWindowTitle("Multires");
    progress.setWindowModality(Qt::WindowModal);
    progress.setCancelButton(nullptr);
    progress.setMinimumDuration(0);
    progress.show();

    QApplication::setOverrideCursor(Qt::WaitCursor);

    MultiresResult result;
    QString error;
    const bool ok = MultiresGenerator::generate(
        source,
        m_projectDir,
        scene->id,
        options,
        result,
        &error,
        [&progress](int percent, const QString& text) {
            progress.setValue(percent);
            progress.setLabelText(text);
            QApplication::processEvents(QEventLoop::ExcludeUserInputEvents);
        }
    );

    QApplication::restoreOverrideCursor();
    progress.setValue(100);

    if (!ok) {
        QMessageBox::critical(this, "Multires", error);
        return;
    }

    scene = currentScene();
    if (!scene) return;
    scene->multiresBasePath = result.basePath;
    scene->multiresTileResolution = result.tileResolution;
    scene->multiresMaxLevel = result.maxLevel;
    scene->multiresCubeResolution = result.cubeResolution;
    markDirty();
    saveCurrent(false);
    refreshSceneControls();

    QMessageBox::information(
        this,
        "Multires",
        QString("Готово. Cubemap %1 px, уровней: %2")
            .arg(result.cubeResolution)
            .arg(result.maxLevel)
    );
}

void MainWindow::editProjectOptions() {
    if (m_projectDir.isEmpty()) {
        QMessageBox::information(this, "Проект", "Сначала создайте или откройте проект.");
        return;
    }

    const Project before = m_project;
    ProjectOptionsDialog dialog(m_project, m_projectDir, this);
    if (dialog.exec() != QDialog::Accepted) return;
    const Project after = dialog.resultProject();

    m_undoStack.push(new LambdaCommand(
        "Настройки тура",
        [this, after] {
            m_project = after;
            markDirty();
            refreshAll();
        },
        [this, before] {
            m_project = before;
            markDirty();
            refreshAll();
        }
    ));
}

void MainWindow::editSceneObjects() {
    Scene* scene = currentScene();
    if (!scene) {
        QMessageBox::information(this, "Объекты сцены", "Сначала выберите сцену.");
        return;
    }

    const QString sceneId = scene->id;
    const Scene before = *scene;
    SceneObjectsDialog dialog(*scene, m_project, m_projectDir, this);
    if (dialog.exec() != QDialog::Accepted) return;
    const Scene after = dialog.resultScene();

    m_undoStack.push(new LambdaCommand(
        "Объекты сцены",
        [this, sceneId, after] {
            if (Scene* target = m_project.findScene(sceneId)) *target = after;
            markDirty();
            refreshSceneControls();
            loadCurrentSceneIntoViewport();
        },
        [this, sceneId, before] {
            if (Scene* target = m_project.findScene(sceneId)) *target = before;
            markDirty();
            refreshSceneControls();
            loadCurrentSceneIntoViewport();
        }
    ));
}

void MainWindow::exportOpenXrPackage() {
    if (m_projectDir.isEmpty()) {
        QMessageBox::information(this, "Экспорт", "Сначала создайте или откройте проект.");
        return;
    }
    if (m_project.scenes.isEmpty()) {
        QMessageBox::information(this, "Экспорт", "В проекте пока нет сцен.");
        return;
    }

    if (m_dirty && !saveCurrent()) return;

    QString suggested = m_project.title;
    suggested.replace(QRegularExpression("[^A-Za-z0-9А-Яа-я_-]+"), "_");
    if (suggested.isEmpty()) suggested = "tour";

    const QString output = QFileDialog::getSaveFileName(
        this,
        "Экспорт Player ZIP",
        QDir(m_projectDir).filePath(suggested + ".player.zip"),
        "Player ZIP (*.player.zip *.zip)"
    );
    if (output.isEmpty()) return;

    QString target = output;
    if (!target.endsWith(".zip", Qt::CaseInsensitive)) target += ".player.zip";

    statusBar()->showMessage("Сборка универсального Player ZIP…");
    QApplication::setOverrideCursor(Qt::WaitCursor);

    QString error;
    const bool ok = PackageExporter::exportOpenXrPackage(
        m_projectDir,
        m_project,
        target,
        &error
    );

    QApplication::restoreOverrideCursor();

    if (!ok) {
        QMessageBox::critical(this, "Ошибка экспорта", error);
        statusBar()->showMessage("Ошибка экспорта", 3000);
        return;
    }

    statusBar()->showMessage("Player ZIP создан: " + QFileInfo(target).fileName(), 5000);
    QMessageBox::information(
        this,
        "Player ZIP",
        "Готово:\n" + QDir::toNativeSeparators(target)
    );
}

void MainWindow::addPanorama() {
    if (m_projectDir.isEmpty()) {
        QMessageBox::information(this, "Проект", "Сначала создайте или откройте проект.");
        return;
    }

    const QString file = QFileDialog::getOpenFileName(this, "Панорама 360°", {}, objectImageFilter());
    if (file.isEmpty()) return;

    QString error;
    const QString asset = ProjectStorage::importAsset(m_projectDir, file, "panoramas", &error);
    if (asset.isEmpty()) {
        QMessageBox::critical(this, "Ошибка", error);
        return;
    }

    Scene scene;
    scene.id = uniqueSceneId("scene");
    scene.title = QFileInfo(file).completeBaseName();
    scene.type = SceneType::Panorama;
    scene.source = asset;
    scene.filename = QFileInfo(file).fileName();
    scene.fov = 100;

    m_project.scenes.push_back(scene);
    if (m_project.firstSceneId.isEmpty()) m_project.firstSceneId = scene.id;
    m_currentSceneId = scene.id;
    markDirty();
    refreshAll();
}

void MainWindow::addXr() {
    if (m_projectDir.isEmpty()) {
        QMessageBox::information(this, "Проект", "Сначала создайте или откройте проект.");
        return;
    }

    const QString file = QFileDialog::getOpenFileName(
        this,
        "XR 180/360",
        {},
        "XR медиа (*.jpg *.jpeg *.png *.webp *.mp4 *.webm)"
    );
    if (file.isEmpty()) return;

    QString error;
    const QString asset = ProjectStorage::importAsset(m_projectDir, file, "xr", &error);
    if (asset.isEmpty()) {
        QMessageBox::critical(this, "Ошибка", error);
        return;
    }

    Scene scene;
    scene.id = uniqueSceneId("xr");
    scene.title = QFileInfo(file).completeBaseName();
    scene.type = SceneType::Xr;
    scene.source = asset;
    scene.filename = QFileInfo(file).fileName();
    const QString suffix = QFileInfo(file).suffix().toLower();
    scene.xrKind = (suffix == "mp4" || suffix == "webm") ? "video" : "image";
    scene.projection = "360";
    scene.fov = 80;

    m_project.scenes.push_back(scene);
    if (m_project.firstSceneId.isEmpty()) m_project.firstSceneId = scene.id;
    m_currentSceneId = scene.id;
    markDirty();
    refreshAll();
}

void MainWindow::addStl() {
    if (m_projectDir.isEmpty()) {
        QMessageBox::information(this, "Проект", "Сначала создайте или откройте проект.");
        return;
    }

    const QString file = QFileDialog::getOpenFileName(this, "STL модель", {}, "STL (*.stl)");
    if (file.isEmpty()) return;

    QString error;
    const QString asset = ProjectStorage::importAsset(m_projectDir, file, "stl", &error);
    if (asset.isEmpty()) {
        QMessageBox::critical(this, "Ошибка", error);
        return;
    }

    Scene scene;
    scene.id = uniqueSceneId("stl");
    scene.title = QFileInfo(file).completeBaseName();
    scene.type = SceneType::Stl;
    scene.source = asset;
    scene.filename = QFileInfo(file).fileName();
    scene.pitch = -15;
    scene.zoom = 1;

    m_project.scenes.push_back(scene);
    if (m_project.firstSceneId.isEmpty()) m_project.firstSceneId = scene.id;
    m_currentSceneId = scene.id;
    markDirty();
    refreshAll();
}

void MainWindow::addObject360() {
    if (m_projectDir.isEmpty()) {
        QMessageBox::information(this, "Проект", "Сначала создайте или откройте проект.");
        return;
    }

    const QString directory = QFileDialog::getExistingDirectory(this, "Папка кадров Object360");
    if (directory.isEmpty()) return;

    const QString sceneId = uniqueSceneId("object");
    const QString targetRoot = QDir(m_projectDir).filePath("assets/object360/" + sceneId);
    QDir().mkpath(targetRoot);

    QDir source(directory);
    QStringList filters{"*.jpg", "*.jpeg", "*.png", "*.webp", "*.bmp"};
    const auto files = source.entryInfoList(filters, QDir::Files, QDir::Name);

    if (files.isEmpty()) {
        QMessageBox::warning(this, "Object360", "В выбранной папке нет изображений.");
        return;
    }

    QVector<QString> row;
    for (const auto& info : files) {
        const QString target = QDir(targetRoot).filePath(info.fileName());
        if (QFile::copy(info.absoluteFilePath(), target)) {
            row.push_back(QDir(m_projectDir).relativeFilePath(target).replace('\\', '/'));
        }
    }

    if (row.isEmpty()) {
        QMessageBox::critical(this, "Object360", "Не удалось скопировать кадры.");
        return;
    }

    Scene scene;
    scene.id = sceneId;
    scene.title = QFileInfo(directory).fileName();
    scene.type = SceneType::Object360;
    scene.sectors = row.size();
    scene.rows = 1;
    scene.frames.push_back(row);
    scene.startSector = 0;
    scene.startRow = 0;

    m_project.scenes.push_back(scene);
    if (m_project.firstSceneId.isEmpty()) m_project.firstSceneId = scene.id;
    m_currentSceneId = scene.id;
    markDirty();
    refreshAll();
}

void MainWindow::deleteCurrentScene() {
    if (m_currentSceneId.isEmpty()) return;

    int index = -1;
    for (int i = 0; i < m_project.scenes.size(); ++i) {
        if (m_project.scenes[i].id == m_currentSceneId) {
            index = i;
            break;
        }
    }
    if (index < 0) return;

    const Scene removed = m_project.scenes[index];
    const QString previousFirst = m_project.firstSceneId;

    m_undoStack.push(new LambdaCommand(
        "Удалить сцену",
        [this, index, removed] {
            if (index < m_project.scenes.size() && m_project.scenes[index].id == removed.id)
                m_project.scenes.removeAt(index);
            else {
                for (int i = 0; i < m_project.scenes.size(); ++i)
                    if (m_project.scenes[i].id == removed.id) { m_project.scenes.removeAt(i); break; }
            }

            if (m_project.firstSceneId == removed.id)
                m_project.firstSceneId = m_project.scenes.isEmpty() ? QString() : m_project.scenes.first().id;

            m_currentSceneId = m_project.firstSceneId;
            markDirty();
            refreshAll();
        },
        [this, index, removed, previousFirst] {
            m_project.scenes.insert(std::min(index, int(m_project.scenes.size())), removed);
            m_project.firstSceneId = previousFirst;
            m_currentSceneId = removed.id;
            markDirty();
            refreshAll();
        }
    ));
}

void MainWindow::refreshAll() {
    m_refreshing = true;
    refreshSceneList();
    refreshProjectControls();
    refreshSceneControls();
    refreshHotspots();
    loadCurrentSceneIntoViewport();
    m_refreshing = false;

    const QString title = m_projectDir.isEmpty()
        ? "3DPL Editor — Native C++"
        : "3DPL Editor — " + m_project.title + (m_dirty ? " *" : "");
    setWindowTitle(title);
}

void MainWindow::refreshSceneList() {
    m_sceneList->clear();

    for (const auto& scene : m_project.scenes) {
        auto* item = new QListWidgetItem(
            sceneTypeLabel(scene.type) + "\n" + scene.title
        );
        item->setData(Qt::UserRole, scene.id);
        m_sceneList->addItem(item);
        if (scene.id == m_currentSceneId) m_sceneList->setCurrentItem(item);
    }
}

void MainWindow::refreshProjectControls() {
    m_projectTitle->setText(m_project.title);
    m_projectMusicName->setText(
        m_project.musicSource.isEmpty()
            ? "Не выбрана"
            : QFileInfo(m_project.musicSource).fileName()
    );
    m_projectMusicVolume->setValue(m_project.musicVolume);
    m_projectMusicLoop->setChecked(m_project.musicLoop);

    m_firstScene->clear();
    for (const auto& scene : m_project.scenes) {
        m_firstScene->addItem(scene.title, scene.id);
        if (scene.id == m_project.firstSceneId)
            m_firstScene->setCurrentIndex(m_firstScene->count() - 1);
    }

    m_rightStack->setCurrentIndex(m_currentSceneId.isEmpty() ? 0 : 1);
}

void MainWindow::refreshSceneControls() {
    const Scene* scene = currentScene();
    if (!scene) {
        m_sceneTypeBadge->setText("НЕТ СЦЕНЫ");
        return;
    }

    m_sceneTypeBadge->setText(sceneTypeLabel(scene->type).toUpper());
    m_sceneTitle->setText(scene->title);
    m_sceneId->setText(scene->id);
    m_sceneYaw->setValue(scene->yaw);
    m_scenePitch->setValue(scene->pitch);
    m_sceneFov->setValue(scene->fov);

    const int projectionIndex = m_sceneProjection->findText(scene->projection);
    m_sceneProjection->setCurrentIndex(projectionIndex >= 0 ? projectionIndex : 0);

    if (scene->type == SceneType::Object360) {
        m_sceneSource->setText(
            QString("%1 ряд(а) × %2 сектор(ов)").arg(scene->rows).arg(scene->sectors)
        );
    } else {
        m_sceneSource->setText(scene->source);
    }

    const bool spherical = scene->type == SceneType::Panorama || scene->type == SceneType::Xr;
    m_sceneFov->setEnabled(spherical);
    m_sceneProjection->setEnabled(scene->type == SceneType::Xr);

    const bool isPanorama = scene->type == SceneType::Panorama;
    const bool isObject = scene->type == SceneType::Object360;
    const bool isStl = scene->type == SceneType::Stl;
    const bool isXr = scene->type == SceneType::Xr;

    m_panoramaOptions->setVisible(isPanorama);
    if (isPanorama) {
        const QString suffix = scene->multiresBasePath.isEmpty()
            ? QString()
            : QString("  [L%1 · %2px]")
                .arg(scene->multiresMaxLevel)
                .arg(scene->multiresCubeResolution);
        m_generateMultires->setText("Создать / обновить Multires" + suffix);
    }

    m_objectOptions->setVisible(isObject);
    m_stlOptions->setVisible(isStl);
    m_xrOptions->setVisible(isXr || isObject || isStl);

    m_objectStartSector->setMaximum(std::max(0, scene->sectors - 1));
    m_objectStartSector->setValue(scene->startSector);
    m_objectStartRow->setMaximum(std::max(0, scene->rows - 1));
    m_objectStartRow->setValue(scene->startRow);

    m_stlZoom->setValue(scene->zoom);
    m_stlWireframe->setChecked(scene->wireframe);
    const QColor stlColor(scene->color);
    m_stlColorButton->setStyleSheet(
        QString("QPushButton{background:%1;color:%2;}")
            .arg(stlColor.name(), stlColor.lightness() > 150 ? "#111111" : "#ffffff")
    );

    m_sceneAutoplay->setChecked(scene->autoplay);
    m_sceneLoop->setChecked(scene->loop);
    m_xrVolume->setValue(scene->volume);

    m_sceneMusicName->setText(
        scene->musicSource.isEmpty() ? "Не выбрана" : QFileInfo(scene->musicSource).fileName()
    );
    m_sceneMusicVolume->setValue(scene->musicVolume);
    m_sceneMusicLoop->setChecked(scene->musicLoop);
    m_sceneNarrationName->setText(
        scene->narrationSource.isEmpty() ? "Не выбрана" : QFileInfo(scene->narrationSource).fileName()
    );
    m_sceneNarrationVolume->setValue(scene->narrationVolume);
    m_sceneLoop->setVisible(isXr && scene->xrKind == "video");
    m_xrVolume->setVisible(isXr && scene->xrKind == "video");
}

void MainWindow::refreshHotspots() {
    const Scene* scene = currentScene();
    m_hotspotTable->setRowCount(0);
    if (!scene) return;

    for (const auto& hotspot : scene->hotspots) {
        const int row = m_hotspotTable->rowCount();
        m_hotspotTable->insertRow(row);

        auto* type = new QTableWidgetItem(hotspot.type);
        type->setData(Qt::UserRole, hotspot.id);
        m_hotspotTable->setItem(row, 0, type);
        m_hotspotTable->setItem(row, 1, new QTableWidgetItem(hotspot.text));
        m_hotspotTable->setItem(row, 2, new QTableWidgetItem(QString::number(hotspot.yaw, 'f', 1)));
        m_hotspotTable->setItem(row, 3, new QTableWidgetItem(QString::number(hotspot.pitch, 'f', 1)));
    }
}

void MainWindow::selectScene(const QString& id) {
    if (id == m_currentSceneId) return;
    m_currentSceneId = id;
    m_refreshing = true;
    refreshProjectControls();
    refreshSceneControls();
    refreshHotspots();
    loadCurrentSceneIntoViewport();
    m_refreshing = false;
}

void MainWindow::loadCurrentSceneIntoViewport() {
    stopVideoPreview();
    const Scene* scene = currentScene();
    if (!scene) {
        m_viewport->setSceneOverlays({}, {}, {}, {});
        m_viewport->clearImage();
        return;
    }

    m_viewport->setSceneOverlays(
        scene->textObjects,
        scene->mediaObjects,
        scene->hotspots,
        m_projectDir
    );
    m_viewport->setView(scene->yaw, scene->pitch, scene->fov);

    if (scene->type == SceneType::Panorama && !scene->source.isEmpty()) {
        const QString file = ProjectStorage::resolveAsset(m_projectDir, scene->source);
        if (!file.isEmpty()) m_viewport->setPanoramaImage(file, "360");
        else m_viewport->clearImage();
        return;
    }

    if (scene->type == SceneType::Xr && !scene->source.isEmpty()) {
        const QString file = ProjectStorage::resolveAsset(m_projectDir, scene->source);
        if (file.isEmpty()) {
            m_viewport->clearImage();
            return;
        }

        if (scene->xrKind == "video") {
            startVideoPreview(*scene, file);
        } else {
            m_viewport->setPanoramaImage(file, scene->projection);
        }
        return;
    }

    if (scene->type == SceneType::Object360 && !scene->frames.isEmpty()) {
        QVector<QVector<QString>> resolvedRows;
        resolvedRows.reserve(scene->frames.size());

        for (const auto& row : scene->frames) {
            QVector<QString> resolved;
            resolved.reserve(row.size());
            for (const auto& relative : row) {
                const QString absolute = ProjectStorage::resolveAsset(m_projectDir, relative);
                if (!absolute.isEmpty()) resolved.push_back(absolute);
            }
            if (!resolved.isEmpty()) resolvedRows.push_back(resolved);
        }

        if (!resolvedRows.isEmpty()) {
            m_viewport->setObject360(resolvedRows, scene->startSector, scene->startRow);
        } else {
            m_viewport->clearImage();
        }
        return;
    }

    if (scene->type == SceneType::Stl && !scene->source.isEmpty()) {
        const QString file = ProjectStorage::resolveAsset(m_projectDir, scene->source);
        if (!file.isEmpty()) {
            m_viewport->setStl(file, QColor(scene->color), scene->wireframe, scene->zoom);
        } else {
            m_viewport->clearImage();
        }
        return;
    }

    // Video preview is handled by the native media layer added next.
    m_viewport->clearImage();
}

void MainWindow::startVideoPreview(const Scene& scene, const QString& filePath) {
    if (!m_mediaPlayer || !m_audioOutput) return;

    m_audioOutput->setVolume(std::clamp(scene.volume / 100.0, 0.0, 1.0));
    m_mediaPlayer->setLoops(scene.loop ? QMediaPlayer::Infinite : QMediaPlayer::Once);
    m_mediaPlayer->setSource(QUrl::fromLocalFile(filePath));
    m_mediaPlayer->play();

    statusBar()->showMessage(
        QString("XR video · %1 · %2")
            .arg(scene.projection, QFileInfo(filePath).fileName()),
        2500
    );
}

void MainWindow::stopVideoPreview() {
    if (!m_mediaPlayer) return;
    if (m_mediaPlayer->playbackState() != QMediaPlayer::StoppedState)
        m_mediaPlayer->stop();
    m_mediaPlayer->setSource({});
}

Scene* MainWindow::currentScene() {
    return m_project.findScene(m_currentSceneId);
}

const Scene* MainWindow::currentScene() const {
    return m_project.findScene(m_currentSceneId);
}

QString MainWindow::uniqueSceneId(const QString& prefix) const {
    QString base = prefix;
    base.replace(QRegularExpression("[^A-Za-z0-9_-]"), "_");
    if (base.isEmpty()) base = "scene";

    for (int i = 1; i < 100000; ++i) {
        const QString id = base + "_" + QString::number(i);
        if (!m_project.findScene(id)) return id;
    }
    return base + "_" + QString::number(QDateTime::currentMSecsSinceEpoch());
}

QString MainWindow::sceneTypeLabel(SceneType type) const {
    switch (type) {
    case SceneType::Object360: return "Object360";
    case SceneType::Stl: return "STL 3D";
    case SceneType::Xr: return "XR Media";
    case SceneType::Panorama:
    default: return "Панорама 360°";
    }
}

QString MainWindow::categoryForScene(SceneType type) const {
    switch (type) {
    case SceneType::Object360: return "object360";
    case SceneType::Stl: return "stl";
    case SceneType::Xr: return "xr";
    case SceneType::Panorama:
    default: return "panoramas";
    }
}

void MainWindow::markDirty() {
    m_dirty = true;
    setWindowTitle("3DPL Editor — " + m_project.title + " *");
    scheduleAutosave();
}

void MainWindow::scheduleAutosave() {
    if (!m_projectDir.isEmpty() && m_autosaveTimer) m_autosaveTimer->start();
}

void MainWindow::addHotspot(double yaw, double pitch) {
    Scene* scene = currentScene();
    if (!scene) return;

    Hotspot hotspot;
    hotspot.id = "hotspot_" + QString::number(QDateTime::currentMSecsSinceEpoch());
    hotspot.type = "scene";
    hotspot.text = "Переход";
    hotspot.yaw = yaw;
    hotspot.pitch = pitch;
    hotspot.anchorYaw = yaw;
    hotspot.anchorPitch = pitch;

    const QString sceneId = scene->id;
    m_undoStack.push(new LambdaCommand(
        "Добавить hotspot",
        [this, sceneId, hotspot] {
            if (auto* s = m_project.findScene(sceneId)) s->hotspots.push_back(hotspot);
            markDirty();
            refreshHotspots();
        },
        [this, sceneId, hotspot] {
            if (auto* s = m_project.findScene(sceneId)) {
                for (int i = 0; i < s->hotspots.size(); ++i) {
                    if (s->hotspots[i].id == hotspot.id) {
                        s->hotspots.removeAt(i);
                        break;
                    }
                }
            }
            markDirty();
            refreshHotspots();
        }
    ));
}

void MainWindow::addObjectHotspot(
    double xPercent,
    double yPercent,
    int sector,
    int row
) {
    Scene* scene = currentScene();
    if (!scene || scene->type != SceneType::Object360) return;

    Hotspot hotspot;
    hotspot.id = "hotspot_" + QString::number(QDateTime::currentMSecsSinceEpoch());
    hotspot.type = "scene";
    hotspot.text = "Переход";
    hotspot.anchorMode = "object360";
    hotspot.anchorX = xPercent;
    hotspot.anchorY = yPercent;
    hotspot.anchorSector = sector;
    hotspot.anchorRow = row;

    const QString sceneId = scene->id;
    m_undoStack.push(new LambdaCommand(
        "Добавить Object360 hotspot",
        [this, sceneId, hotspot] {
            if (auto* s = m_project.findScene(sceneId)) s->hotspots.push_back(hotspot);
            markDirty();
            refreshHotspots();
        },
        [this, sceneId, hotspot] {
            if (auto* s = m_project.findScene(sceneId)) {
                for (int i = 0; i < s->hotspots.size(); ++i) {
                    if (s->hotspots[i].id == hotspot.id) {
                        s->hotspots.removeAt(i);
                        break;
                    }
                }
            }
            markDirty();
            refreshHotspots();
        }
    ));
}

void MainWindow::chooseProjectMusic() {
    if (m_projectDir.isEmpty()) return;
    const QString file = QFileDialog::getOpenFileName(
        this,
        "Музыка тура",
        {},
        "Аудио (*.mp3 *.ogg *.wav *.m4a *.aac *.flac)"
    );
    if (file.isEmpty()) return;

    QString error;
    const QString asset = ProjectStorage::importAsset(m_projectDir, file, "audio", &error);
    if (asset.isEmpty()) {
        QMessageBox::critical(this, "Аудио", error);
        return;
    }
    m_project.musicSource = asset;
    markDirty();
    refreshProjectControls();
}

void MainWindow::removeProjectMusic() {
    if (m_project.musicSource.isEmpty()) return;
    m_project.musicSource.clear();
    markDirty();
    refreshProjectControls();
}

void MainWindow::chooseSceneMusic() {
    Scene* scene = currentScene();
    if (!scene || m_projectDir.isEmpty()) return;

    const QString file = QFileDialog::getOpenFileName(
        this,
        "Музыка сцены",
        {},
        "Аудио (*.mp3 *.ogg *.wav *.m4a *.aac *.flac)"
    );
    if (file.isEmpty()) return;

    QString error;
    const QString asset = ProjectStorage::importAsset(m_projectDir, file, "audio", &error);
    if (asset.isEmpty()) {
        QMessageBox::critical(this, "Аудио", error);
        return;
    }
    scene->musicSource = asset;
    markDirty();
    refreshSceneControls();
}

void MainWindow::removeSceneMusic() {
    if (auto* scene = currentScene()) {
        if (scene->musicSource.isEmpty()) return;
        scene->musicSource.clear();
        markDirty();
        refreshSceneControls();
    }
}

void MainWindow::chooseSceneNarration() {
    Scene* scene = currentScene();
    if (!scene || m_projectDir.isEmpty()) return;

    const QString file = QFileDialog::getOpenFileName(
        this,
        "Озвучка сцены",
        {},
        "Аудио (*.mp3 *.ogg *.wav *.m4a *.aac *.flac)"
    );
    if (file.isEmpty()) return;

    QString error;
    const QString asset = ProjectStorage::importAsset(m_projectDir, file, "audio", &error);
    if (asset.isEmpty()) {
        QMessageBox::critical(this, "Озвучка", error);
        return;
    }
    scene->narrationSource = asset;
    markDirty();
    refreshSceneControls();
}

void MainWindow::removeSceneNarration() {
    if (auto* scene = currentScene()) {
        if (scene->narrationSource.isEmpty()) return;
        scene->narrationSource.clear();
        markDirty();
        refreshSceneControls();
    }
}

void MainWindow::editSelectedHotspot() {
    Scene* scene = currentScene();
    const int row = m_hotspotTable->currentRow();
    if (!scene || row < 0 || row >= scene->hotspots.size()) return;

    Hotspot before = scene->hotspots.at(row);
    Hotspot edited = before;

    QDialog dialog(this);
    dialog.setWindowTitle("Hotspot");
    dialog.resize(480, 520);

    auto* layout = new QVBoxLayout(&dialog);
    auto* form = new QFormLayout;

    auto* type = new QComboBox;
    type->addItems({"scene", "info", "url"});
    type->setCurrentText(edited.type);

    auto* text = new QLineEdit(edited.text);
    auto* target = new QComboBox;
    target->addItem("—", "");
    for (const auto& candidate : m_project.scenes) {
        target->addItem(candidate.title, candidate.id);
    }
    int targetIndex = target->findData(edited.targetSceneId);
    if (targetIndex >= 0) target->setCurrentIndex(targetIndex);

    auto* url = new QLineEdit(edited.url);
    auto* info = new QTextEdit;
    info->setPlainText(edited.info);
    info->setMinimumHeight(100);

    auto* yaw = new QDoubleSpinBox;
    yaw->setRange(-360, 360);
    yaw->setDecimals(2);
    yaw->setValue(edited.yaw);

    auto* pitch = new QDoubleSpinBox;
    pitch->setRange(-89, 89);
    pitch->setDecimals(2);
    pitch->setValue(edited.pitch);

    auto* anchorX = new QDoubleSpinBox;
    anchorX->setRange(0, 100);
    anchorX->setDecimals(2);
    anchorX->setValue(edited.anchorX);

    auto* anchorY = new QDoubleSpinBox;
    anchorY->setRange(0, 100);
    anchorY->setDecimals(2);
    anchorY->setValue(edited.anchorY);

    auto* sector = new QSpinBox;
    sector->setRange(0, 100000);
    sector->setValue(edited.anchorSector);

    auto* anchorRow = new QSpinBox;
    anchorRow->setRange(0, 10000);
    anchorRow->setValue(edited.anchorRow);

    form->addRow("Тип", type);
    form->addRow("Подпись", text);
    form->addRow("Целевая сцена", target);
    form->addRow("URL", url);
    form->addRow("Информация", info);
    form->addRow("Yaw", yaw);
    form->addRow("Pitch", pitch);

    if (scene->type == SceneType::Object360) {
        form->addRow("Anchor X, %", anchorX);
        form->addRow("Anchor Y, %", anchorY);
        form->addRow("Сектор", sector);
        form->addRow("Ряд", anchorRow);
    }

    layout->addLayout(form);

    auto updateVisibility = [=](const QString& value) {
        target->setEnabled(value == "scene");
        url->setEnabled(value == "url");
        info->setEnabled(value == "info");
    };
    updateVisibility(type->currentText());
    connect(type, &QComboBox::currentTextChanged, &dialog, updateVisibility);

    auto* buttons = new QDialogButtonBox(
        QDialogButtonBox::Save | QDialogButtonBox::Cancel
    );
    connect(buttons, &QDialogButtonBox::accepted, &dialog, &QDialog::accept);
    connect(buttons, &QDialogButtonBox::rejected, &dialog, &QDialog::reject);
    layout->addWidget(buttons);

    if (dialog.exec() != QDialog::Accepted) return;

    edited.type = type->currentText();
    edited.text = text->text().trimmed();
    edited.targetSceneId = target->currentData().toString();
    edited.url = url->text().trimmed();
    edited.info = info->toPlainText().trimmed();
    edited.yaw = yaw->value();
    edited.pitch = pitch->value();
    edited.anchorX = anchorX->value();
    edited.anchorY = anchorY->value();
    edited.anchorSector = sector->value();
    edited.anchorRow = anchorRow->value();

    const QString sceneId = scene->id;
    const QString hotspotId = edited.id;

    m_undoStack.push(new LambdaCommand(
        "Изменить hotspot",
        [this, sceneId, hotspotId, edited] {
            if (auto* s = m_project.findScene(sceneId)) {
                for (auto& h : s->hotspots) {
                    if (h.id == hotspotId) {
                        h = edited;
                        break;
                    }
                }
            }
            markDirty();
            refreshHotspots();
        },
        [this, sceneId, hotspotId, before] {
            if (auto* s = m_project.findScene(sceneId)) {
                for (auto& h : s->hotspots) {
                    if (h.id == hotspotId) {
                        h = before;
                        break;
                    }
                }
            }
            markDirty();
            refreshHotspots();
        }
    ));
}

void MainWindow::deleteSelectedHotspot() {
    Scene* scene = currentScene();
    const int row = m_hotspotTable->currentRow();
    if (!scene || row < 0 || row >= scene->hotspots.size()) return;

    const Hotspot removed = scene->hotspots[row];
    const QString sceneId = scene->id;

    m_undoStack.push(new LambdaCommand(
        "Удалить hotspot",
        [this, sceneId, removed] {
            if (auto* s = m_project.findScene(sceneId)) {
                for (int i = 0; i < s->hotspots.size(); ++i)
                    if (s->hotspots[i].id == removed.id) { s->hotspots.removeAt(i); break; }
            }
            markDirty();
            refreshHotspots();
        },
        [this, sceneId, removed, row] {
            if (auto* s = m_project.findScene(sceneId))
                s->hotspots.insert(std::min(row, int(s->hotspots.size())), removed);
            markDirty();
            refreshHotspots();
        }
    ));
}

void MainWindow::setProjectTitle(const QString& value) {
    const QString next = value.trimmed().isEmpty() ? QString("Виртуальная экскурсия") : value.trimmed();
    if (next == m_project.title) return;
    const QString before = m_project.title;

    m_undoStack.push(new LambdaCommand(
        "Название проекта",
        [this, next] { m_project.title = next; markDirty(); refreshProjectControls(); },
        [this, before] { m_project.title = before; markDirty(); refreshProjectControls(); }
    ));
}

void MainWindow::setSceneTitle(const QString& value) {
    Scene* scene = currentScene();
    if (!scene) return;
    const QString next = value.trimmed().isEmpty() ? scene->id : value.trimmed();
    if (scene->title == next) return;

    const QString sceneId = scene->id;
    const QString before = scene->title;

    m_undoStack.push(new LambdaCommand(
        "Название сцены",
        [this, sceneId, next] {
            if (auto* s = m_project.findScene(sceneId)) s->title = next;
            markDirty(); refreshSceneList(); refreshProjectControls(); refreshSceneControls();
        },
        [this, sceneId, before] {
            if (auto* s = m_project.findScene(sceneId)) s->title = before;
            markDirty(); refreshSceneList(); refreshProjectControls(); refreshSceneControls();
        }
    ));
}

void MainWindow::setSceneYaw(double value) {
    Scene* scene = currentScene();
    if (!scene || qFuzzyCompare(scene->yaw, value)) return;
    scene->yaw = value;
    markDirty();
    m_viewport->setView(scene->yaw, scene->pitch, scene->fov);
}

void MainWindow::setScenePitch(double value) {
    Scene* scene = currentScene();
    if (!scene || qFuzzyCompare(scene->pitch, value)) return;
    scene->pitch = value;
    markDirty();
    m_viewport->setView(scene->yaw, scene->pitch, scene->fov);
}

void MainWindow::setSceneFov(double value) {
    Scene* scene = currentScene();
    if (!scene || qFuzzyCompare(scene->fov, value)) return;
    scene->fov = value;
    markDirty();
    m_viewport->setView(scene->yaw, scene->pitch, scene->fov);
}

void MainWindow::setSceneProjection(const QString& value) {
    Scene* scene = currentScene();
    if (!scene || scene->projection == value) return;
    scene->projection = value;
    markDirty();
}

void MainWindow::closeEvent(QCloseEvent* event) {
    if (!m_dirty) {
        event->accept();
        return;
    }

    const auto answer = QMessageBox::question(
        this,
        "Закрыть 3DPL Editor",
        "Сохранить изменения?",
        QMessageBox::Save | QMessageBox::Discard | QMessageBox::Cancel
    );

    if (answer == QMessageBox::Cancel) {
        event->ignore();
        return;
    }
    if (answer == QMessageBox::Save && !saveCurrent()) {
        event->ignore();
        return;
    }
    event->accept();
}
