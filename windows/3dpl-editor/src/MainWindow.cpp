#include "MainWindow.h"

#include "io/ProjectStorage.h"
#include "render/PanoramaViewport.h"

#include <QCloseEvent>
#include <QColor>
#include <QComboBox>
#include <QDateTime>
#include <QDir>
#include <QDoubleSpinBox>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
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
    fileMenu->addAction("Сохранить", this, &MainWindow::saveProject, QKeySequence::Save);
    fileMenu->addAction("Сохранить как…", this, &MainWindow::saveProjectAs, QKeySequence::SaveAs);
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
    layout->addStretch();

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
    m_deleteHotspot = smallButton("Удалить");
    hsRow->addWidget(addCenter);
    hsRow->addWidget(m_deleteHotspot);
    hotspotLayout->addLayout(hsRow);

    connect(addCenter, &QPushButton::clicked, this, [this] {
        addHotspot(m_viewport->yaw(), m_viewport->pitch());
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
        m_viewport->clearImage();
        return;
    }

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
