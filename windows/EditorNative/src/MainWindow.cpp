#include "MainWindow.h"

#include "PanoramaViewport.h"
#include "ProjectDocument.h"
#include "SceneInspector.h"

#include <algorithm>
#include <QAction>
#include <QCloseEvent>
#include <QDir>
#include <QFileDialog>
#include <QFileInfo>
#include <QInputDialog>
#include <QJsonArray>
#include <QJsonObject>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QMenu>
#include <QMenuBar>
#include <QMessageBox>
#include <QSettings>
#include <QSplitter>
#include <QStatusBar>
#include <QTimer>
#include <QToolBar>
#include <QVBoxLayout>

MainWindow::MainWindow(QWidget* parent)
    : QMainWindow(parent),
      m_document(new ProjectDocument(this)) {
    resize(1500, 900);
    setMinimumSize(1100, 700);
    buildUi();
    buildMenus();
    applyTheme();

    connect(m_document, &ProjectDocument::scenesChanged, this, [this] {
        refreshSceneList();
        if (m_document->sceneCount() == 0)
            setCurrentScene(-1);
        else if (m_currentScene < 0 || m_currentScene >= m_document->sceneCount())
            setCurrentScene(std::clamp(m_currentScene, 0, m_document->sceneCount() - 1));
        else
            refreshCurrentScene(true);
        updateStatus();
    });

    connect(m_document, &ProjectDocument::dirtyChanged, this, [this](bool) {
        refreshWindowTitle();
    });
    connect(m_document, &ProjectDocument::documentChanged, this, [this] {
        refreshWindowTitle();
        updateStatus();
    });

    connect(m_sceneList, &QListWidget::currentRowChanged, this, [this](int row) {
        if (!m_refreshing)
            setCurrentScene(row);
    });

    connect(m_inspector, &SceneInspector::sceneChanged, this,
            [this](int index, const QJsonObject& scene) {
        if (m_document->updateScene(index, scene)) {
            refreshSceneList();
            if (index == m_currentScene)
                refreshCurrentScene(true);
        }
    });

    connect(m_inspector, &SceneInspector::deleteHotspotRequested, this,
            [this](int sceneIndex, int hotspotIndex) {
        if (m_document->removeHotspot(sceneIndex, hotspotIndex))
            refreshCurrentScene(true);
    });

    connect(m_viewport, &PanoramaViewport::viewChanged, this,
            [this](double yaw, double pitch, double fov) {
        if (m_currentScene < 0)
            return;
        QJsonObject scene = m_document->sceneAt(m_currentScene);
        if (scene.isEmpty())
            return;
        scene.insert("yaw", yaw);
        scene.insert("pitch", pitch);
        if (ProjectDocument::sceneType(scene) == "xr") {
            QJsonObject xr = scene.value("xr").toObject();
            xr.insert("fov", fov);
            scene.insert("xr", xr);
        } else {
            scene.insert("hfov", fov);
        }
        m_document->updateScene(m_currentScene, scene);
    });

    connect(m_viewport, &PanoramaViewport::addHotspotRequested,
            this, &MainWindow::addHotspotAt);
    connect(m_viewport, &PanoramaViewport::hotspotClicked,
            m_inspector, &SceneInspector::selectHotspot);

    connect(m_projectTitle, &QLineEdit::editingFinished, this, [this] {
        if (m_document->isLoaded())
            m_document->setTitle(m_projectTitle->text().trimmed());
    });

    m_autosave = new QTimer(this);
    m_autosave->setInterval(30'000);
    connect(m_autosave, &QTimer::timeout, this, [this] {
        if (m_document->isLoaded() && m_document->isDirty()) {
            QString error;
            m_document->autosave(&error);
            if (!error.isEmpty())
                statusBar()->showMessage(QString::fromUtf8("Autosave: ") + error, 5000);
        }
    });
    m_autosave->start();

    refreshWindowTitle();
    updateStatus();
}

void MainWindow::buildUi() {
    auto* central = new QWidget(this);
    auto* layout = new QVBoxLayout(central);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(0);

    auto* titleBar = new QWidget(central);
    titleBar->setObjectName("projectBar");
    auto* titleLayout = new QHBoxLayout(titleBar);
    titleLayout->setContentsMargins(12, 7, 12, 7);
    auto* label = new QLabel(QString::fromUtf8("ПРОЕКТ"), titleBar);
    label->setObjectName("caption");
    m_projectTitle = new QLineEdit(titleBar);
    m_projectTitle->setPlaceholderText(QString::fromUtf8("Название тура"));
    titleLayout->addWidget(label);
    titleLayout->addWidget(m_projectTitle, 1);
    layout->addWidget(titleBar);

    auto* splitter = new QSplitter(Qt::Horizontal, central);
    splitter->setChildrenCollapsible(false);

    auto* left = new QWidget(splitter);
    auto* leftLayout = new QVBoxLayout(left);
    leftLayout->setContentsMargins(8, 8, 8, 8);
    auto* scenesCaption = new QLabel(QString::fromUtf8("СЦЕНЫ"), left);
    scenesCaption->setObjectName("caption");
    m_sceneList = new QListWidget(left);
    m_sceneList->setMinimumWidth(240);
    m_sceneList->setMaximumWidth(360);
    m_sceneList->setAlternatingRowColors(false);
    leftLayout->addWidget(scenesCaption);
    leftLayout->addWidget(m_sceneList, 1);

    m_viewport = new PanoramaViewport(splitter);

    m_inspector = new SceneInspector(splitter);
    m_inspector->setMinimumWidth(300);
    m_inspector->setMaximumWidth(420);

    splitter->addWidget(left);
    splitter->addWidget(m_viewport);
    splitter->addWidget(m_inspector);
    splitter->setStretchFactor(0, 0);
    splitter->setStretchFactor(1, 1);
    splitter->setStretchFactor(2, 0);
    splitter->setSizes({270, 900, 340});

    layout->addWidget(splitter, 1);
    setCentralWidget(central);

    m_status = new QLabel(this);
    statusBar()->addPermanentWidget(m_status);
}

void MainWindow::buildMenus() {
    auto* fileMenu = menuBar()->addMenu(QString::fromUtf8("Файл"));
    QAction* newAction = fileMenu->addAction(QString::fromUtf8("Новый проект…"));
    newAction->setShortcut(QKeySequence::New);
    connect(newAction, &QAction::triggered, this, &MainWindow::newProject);

    QAction* openAction = fileMenu->addAction(QString::fromUtf8("Открыть…"));
    openAction->setShortcut(QKeySequence::Open);
    connect(openAction, &QAction::triggered, this, &MainWindow::chooseOpenProject);

    fileMenu->addSeparator();
    QAction* saveAction = fileMenu->addAction(QString::fromUtf8("Сохранить"));
    saveAction->setShortcut(QKeySequence::Save);
    connect(saveAction, &QAction::triggered, this, &MainWindow::saveProject);

    QAction* saveAsAction = fileMenu->addAction(QString::fromUtf8("Сохранить как…"));
    saveAsAction->setShortcut(QKeySequence::SaveAs);
    connect(saveAsAction, &QAction::triggered, this, &MainWindow::saveProjectAs);

    fileMenu->addSeparator();
    QAction* exitAction = fileMenu->addAction(QString::fromUtf8("Выход"));
    connect(exitAction, &QAction::triggered, this, &QWidget::close);

    auto* sceneMenu = menuBar()->addMenu(QString::fromUtf8("Сцена"));
    QAction* panoramaAction = sceneMenu->addAction(QString::fromUtf8("Добавить панораму…"));
    connect(panoramaAction, &QAction::triggered, this, &MainWindow::addPanorama);

    QAction* objectAction = sceneMenu->addAction(QString::fromUtf8("Добавить Object360"));
    connect(objectAction, &QAction::triggered, this, [this] { addGenericScene("object360"); });

    QAction* stlAction = sceneMenu->addAction(QString::fromUtf8("Добавить STL"));
    connect(stlAction, &QAction::triggered, this, [this] { addGenericScene("stl"); });

    QAction* xrAction = sceneMenu->addAction(QString::fromUtf8("Добавить XR"));
    connect(xrAction, &QAction::triggered, this, [this] { addGenericScene("xr"); });

    sceneMenu->addSeparator();
    QAction* deleteSceneAction = sceneMenu->addAction(QString::fromUtf8("Удалить сцену"));
    deleteSceneAction->setShortcut(QKeySequence::Delete);
    connect(deleteSceneAction, &QAction::triggered, this, &MainWindow::deleteCurrentScene);

    auto* toolbar = addToolBar(QString::fromUtf8("Основная"));
    toolbar->setMovable(false);
    toolbar->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);
    toolbar->addAction(newAction);
    toolbar->addAction(openAction);
    toolbar->addAction(saveAction);
    toolbar->addSeparator();
    toolbar->addAction(panoramaAction);
    toolbar->addAction(objectAction);
    toolbar->addAction(stlAction);
    toolbar->addAction(xrAction);
}

void MainWindow::applyTheme() {
    setStyleSheet(R"(
        QMainWindow, QWidget { background:#070b13; color:#e9eef9; }
        QMenuBar, QMenu, QToolBar, QStatusBar { background:#0b1220; color:#e9eef9; }
        QToolBar { border-bottom:1px solid #1f2b40; spacing:4px; padding:4px; }
        QToolButton { background:#132039; border:1px solid #243653; border-radius:7px; padding:6px 10px; }
        QToolButton:hover { background:#1b2d4b; border-color:#75e7d6; }
        #projectBar { background:#0a111e; border-bottom:1px solid #1e2a3d; }
        #caption { color:#75e7d6; font-weight:700; letter-spacing:1px; }
        QLineEdit, QTextEdit, QComboBox, QDoubleSpinBox, QListWidget {
            background:#0d1728; color:#f2f5fb; border:1px solid #263750;
            border-radius:6px; padding:5px;
        }
        QListWidget::item { padding:9px 7px; border-radius:6px; }
        QListWidget::item:selected { background:#17314a; color:#ffffff; }
        QListWidget::item:hover { background:#10233a; }
        QGroupBox {
            border:1px solid #24334a; border-radius:8px; margin-top:10px;
            padding-top:8px; font-weight:700; color:#9fb4d1;
        }
        QGroupBox::title { subcontrol-origin:margin; left:9px; padding:0 5px; }
        QPushButton {
            background:#162842; border:1px solid #2a4265; color:#fff;
            border-radius:7px; padding:7px;
        }
        QPushButton:hover { border-color:#75e7d6; }
        QSplitter::handle { background:#152136; width:2px; }
    )");
}

bool MainWindow::openProject(const QString& fileName) {
    if (!maybeSave())
        return false;

    QString error;
    if (!m_document->load(fileName, &error)) {
        showError(QString::fromUtf8("Не удалось открыть проект"), error);
        return false;
    }

    m_projectTitle->setText(m_document->title());
    refreshSceneList();
    setCurrentScene(m_document->sceneCount() > 0 ? 0 : -1);

    const QString autosave = fileName + ".autosave";
    if (QFileInfo::exists(autosave) &&
        QFileInfo(autosave).lastModified() > QFileInfo(fileName).lastModified()) {
        statusBar()->showMessage(QString::fromUtf8("Найдена более новая autosave-копия: ") + autosave, 9000);
    }

    QSettings().setValue("lastProject", fileName);
    return true;
}

void MainWindow::newProject() {
    if (!maybeSave())
        return;
    const QString dir = QFileDialog::getExistingDirectory(
        this, QString::fromUtf8("Папка нового проекта"));
    if (dir.isEmpty())
        return;

    QString error;
    if (!m_document->createNew(dir, &error)) {
        showError(QString::fromUtf8("Новый проект"), error);
        return;
    }
    m_projectTitle->setText(m_document->title());
    setCurrentScene(-1);
}

void MainWindow::chooseOpenProject() {
    const QString file = QFileDialog::getOpenFileName(
        this,
        QString::fromUtf8("Открыть проект"),
        QSettings().value("lastProject").toString(),
        QString::fromUtf8("3DPL project (*.json);;Все файлы (*.*)")
    );
    if (!file.isEmpty())
        openProject(file);
}

void MainWindow::saveProject() {
    if (!m_document->isLoaded())
        return;
    QString error;
    if (!m_document->save(&error))
        showError(QString::fromUtf8("Сохранение"), error);
    else
        statusBar()->showMessage(QString::fromUtf8("Проект сохранён"), 2500);
}

void MainWindow::saveProjectAs() {
    if (!m_document->isLoaded())
        return;
    const QString file = QFileDialog::getSaveFileName(
        this,
        QString::fromUtf8("Сохранить проект"),
        m_document->fileName(),
        QString::fromUtf8("3DPL project (*.json)")
    );
    if (file.isEmpty())
        return;

    QString error;
    if (!m_document->saveAs(file, &error))
        showError(QString::fromUtf8("Сохранение"), error);
}

void MainWindow::addPanorama() {
    if (!m_document->isLoaded()) {
        QMessageBox::information(this, QString::fromUtf8("Панорама"),
            QString::fromUtf8("Сначала создайте или откройте проект."));
        return;
    }

    const QString file = QFileDialog::getOpenFileName(
        this,
        QString::fromUtf8("Добавить 360° панораму"),
        QString(),
        QString::fromUtf8("Изображения (*.jpg *.jpeg *.png *.webp *.bmp *.tif *.tiff)")
    );
    if (file.isEmpty())
        return;

    QString error;
    const int index = m_document->addPanorama(file, &error);
    if (index < 0) {
        showError(QString::fromUtf8("Импорт панорамы"), error);
        return;
    }
    setCurrentScene(index);
}

void MainWindow::addGenericScene(const QString& type) {
    if (!m_document->isLoaded()) {
        QMessageBox::information(this, QString::fromUtf8("Сцена"),
            QString::fromUtf8("Сначала создайте или откройте проект."));
        return;
    }

    QString defaultName;
    if (type == "object360") defaultName = "Object360";
    else if (type == "stl") defaultName = "STL 3D";
    else if (type == "xr") defaultName = "XR Media";
    else defaultName = "Scene";

    const QString name = QInputDialog::getText(
        this, QString::fromUtf8("Новая сцена"), QString::fromUtf8("Название:"),
        QLineEdit::Normal, defaultName);
    if (name.isEmpty())
        return;

    const int index = m_document->addGenericScene(type, name);
    setCurrentScene(index);
}

void MainWindow::deleteCurrentScene() {
    if (m_currentScene < 0)
        return;
    const QJsonObject scene = m_document->sceneAt(m_currentScene);
    const auto answer = QMessageBox::question(
        this,
        QString::fromUtf8("Удалить сцену"),
        QString::fromUtf8("Удалить «%1»?").arg(scene.value("title").toString())
    );
    if (answer != QMessageBox::Yes)
        return;
    m_document->removeScene(m_currentScene);
}

void MainWindow::addHotspotAt(double yaw, double pitch) {
    if (m_currentScene < 0)
        return;
    if (m_document->addHotspot(m_currentScene, yaw, pitch, "info"))
        refreshCurrentScene(true);
}

void MainWindow::refreshSceneList() {
    m_refreshing = true;
    const int selected = m_currentScene;
    m_sceneList->clear();

    for (int i = 0; i < m_document->sceneCount(); ++i) {
        const QJsonObject scene = m_document->sceneAt(i);
        const QString type = ProjectDocument::sceneType(scene);
        QString icon;
        if (type == "panorama") icon = QString::fromUtf8("◌");
        else if (type == "object360") icon = QString::fromUtf8("◉");
        else if (type == "stl") icon = QString::fromUtf8("◆");
        else if (type == "xr") icon = QString::fromUtf8("◈");
        else icon = QString::fromUtf8("•");

        const int hotspotCount = scene.value("hotspots").toArray().size();
        auto* item = new QListWidgetItem(
            icon + "  " + scene.value("title").toString() +
            QString::fromUtf8("
   %1 · точек: %2").arg(type).arg(hotspotCount)
        );
        item->setData(Qt::UserRole, scene.value("id").toString());
        m_sceneList->addItem(item);
    }

    if (selected >= 0 && selected < m_sceneList->count())
        m_sceneList->setCurrentRow(selected);
    m_refreshing = false;
}

void MainWindow::setCurrentScene(int index) {
    m_currentScene = index;
    m_refreshing = true;
    if (index >= 0 && index < m_sceneList->count())
        m_sceneList->setCurrentRow(index);
    else
        m_sceneList->setCurrentRow(-1);
    m_refreshing = false;
    refreshCurrentScene(false);
}

void MainWindow::refreshCurrentScene(bool keepView) {
    if (m_currentScene < 0 || m_currentScene >= m_document->sceneCount()) {
        m_viewport->clearPanorama();
        m_viewport->setHotspots({});
        m_inspector->clearScene();
        updateStatus();
        return;
    }

    const QJsonObject scene = m_document->sceneAt(m_currentScene);
    m_inspector->setScene(scene, m_currentScene);

    const QString type = ProjectDocument::sceneType(scene);
    const QImage image = m_document->loadImageValue(m_document->sceneImageValue(scene));

    if (!image.isNull())
        m_viewport->setPanorama(image);
    else
        m_viewport->clearPanorama();

    m_viewport->setHotspots(scene.value("hotspots").toArray());

    if (!keepView) {
        double fov = scene.value("hfov").toDouble(100.0);
        if (type == "xr")
            fov = scene.value("xr").toObject().value("fov").toDouble(80.0);
        m_viewport->setView(
            scene.value("yaw").toDouble(),
            scene.value("pitch").toDouble(),
            fov
        );
    }

    if (type != "panorama" && image.isNull()) {
        statusBar()->showMessage(
            QString::fromUtf8("Сцена %1 создана. Нативный импорт ресурсов для этого типа переносится следующим модулем.").arg(type),
            5000
        );
    }
    updateStatus();
}

void MainWindow::refreshWindowTitle() {
    QString name = QString::fromUtf8("3DPL Editor");
    if (m_document->isLoaded())
        name += " — " + m_document->title();
    if (m_document->isDirty())
        name += " *";
    setWindowTitle(name);
}

void MainWindow::updateStatus() {
    if (!m_document->isLoaded()) {
        m_status->setText(QString::fromUtf8("Нет проекта"));
        m_projectTitle->setEnabled(false);
        return;
    }
    m_projectTitle->setEnabled(true);
    m_projectTitle->setText(m_document->title());
    m_status->setText(
        QString::fromUtf8("%1 сцен · %2")
            .arg(m_document->sceneCount())
            .arg(QFileInfo(m_document->fileName()).fileName())
    );
}

bool MainWindow::maybeSave() {
    if (!m_document->isLoaded() || !m_document->isDirty())
        return true;

    const auto result = QMessageBox::question(
        this,
        QString::fromUtf8("Несохранённые изменения"),
        QString::fromUtf8("Сохранить изменения проекта?"),
        QMessageBox::Save | QMessageBox::Discard | QMessageBox::Cancel
    );

    if (result == QMessageBox::Cancel)
        return false;
    if (result == QMessageBox::Save) {
        QString error;
        if (!m_document->save(&error)) {
            showError(QString::fromUtf8("Сохранение"), error);
            return false;
        }
    }
    return true;
}

void MainWindow::showError(const QString& title, const QString& message) {
    QMessageBox::critical(this, title, message);
}

void MainWindow::closeEvent(QCloseEvent* event) {
    if (maybeSave())
        event->accept();
    else
        event->ignore();
}
