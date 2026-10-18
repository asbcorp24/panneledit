#include "MainWindow.h"
#include "PanoramaView.h"

#include <QAction>
#include <QApplication>
#include <QCloseEvent>
#include <QComboBox>
#include <QDir>
#include <QDockWidget>
#include <QDoubleSpinBox>
#include <QFileDialog>
#include <QFileInfo>
#include <QFormLayout>
#include <QHBoxLayout>
#include <QInputDialog>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QMenuBar>
#include <QMessageBox>
#include <QPushButton>
#include <QSplitter>
#include <QStatusBar>
#include <QToolBar>
#include <QUuid>
#include <QVBoxLayout>

namespace {

QDoubleSpinBox* angleSpin(double min, double max, double step, QWidget *parent) {
    auto *spin = new QDoubleSpinBox(parent);
    spin->setRange(min, max);
    spin->setDecimals(2);
    spin->setSingleStep(step);
    return spin;
}

}

MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent) {
    applyDarkPalette();
    buildUi();
    buildMenus();

    connect(&m_project, &ProjectModel::changed, this, [this] {
        if (!m_updatingUi) setProjectDirty(true);
    });

    statusBar()->showMessage(QStringLiteral("Создайте или откройте проект"));
    updateWindowTitle();
}

void MainWindow::applyDarkPalette() {
    QPalette p;
    p.setColor(QPalette::Window, QColor("#10141d"));
    p.setColor(QPalette::WindowText, QColor("#f4f7fb"));
    p.setColor(QPalette::Base, QColor("#0a0d13"));
    p.setColor(QPalette::AlternateBase, QColor("#141a26"));
    p.setColor(QPalette::Text, QColor("#edf3ff"));
    p.setColor(QPalette::Button, QColor("#1a2333"));
    p.setColor(QPalette::ButtonText, QColor("#f4f7fb"));
    p.setColor(QPalette::Highlight, QColor("#41cdb8"));
    p.setColor(QPalette::HighlightedText, QColor("#06110f"));
    p.setColor(QPalette::ToolTipBase, QColor("#1b2230"));
    p.setColor(QPalette::ToolTipText, QColor("#ffffff"));
    QApplication::setPalette(p);
}

void MainWindow::buildUi() {
    auto *splitter = new QSplitter(this);
    splitter->setChildrenCollapsible(false);

    // Scene browser
    auto *scenePanel = new QWidget(splitter);
    auto *sceneLayout = new QVBoxLayout(scenePanel);
    sceneLayout->setContentsMargins(8, 8, 8, 8);
    sceneLayout->addWidget(new QLabel(QStringLiteral("СЦЕНЫ"), scenePanel));

    m_sceneList = new QListWidget(scenePanel);
    m_sceneList->setMinimumWidth(220);
    sceneLayout->addWidget(m_sceneList, 1);

    auto *sceneButtons = new QHBoxLayout();
    auto *addScene = new QPushButton(QStringLiteral("+ Сцена"), scenePanel);
    auto *removeScene = new QPushButton(QStringLiteral("−"), scenePanel);
    sceneButtons->addWidget(addScene, 1);
    sceneButtons->addWidget(removeScene);
    sceneLayout->addLayout(sceneButtons);

    // Native viewport
    auto *centerPanel = new QWidget(splitter);
    auto *centerLayout = new QVBoxLayout(centerPanel);
    centerLayout->setContentsMargins(0, 0, 0, 0);
    m_view = new PanoramaView(centerPanel);
    centerLayout->addWidget(m_view, 1);

    auto *hint = new QLabel(
        QStringLiteral("ЛКМ — обзор   •   Колесо — FOV   •   Двойной клик — hotspot"),
        centerPanel
    );
    hint->setAlignment(Qt::AlignCenter);
    hint->setStyleSheet("padding:6px;color:#8d9bb4;background:#0b0f16;");
    centerLayout->addWidget(hint);

    // Inspector
    auto *inspector = new QWidget(splitter);
    inspector->setMinimumWidth(290);
    auto *inspectorLayout = new QVBoxLayout(inspector);
    inspectorLayout->setContentsMargins(10, 8, 10, 8);
    inspectorLayout->addWidget(new QLabel(QStringLiteral("ИНСПЕКТОР"), inspector));

    auto *form = new QFormLayout();
    m_titleEdit = new QLineEdit(inspector);
    m_typeCombo = new QComboBox(inspector);
    m_typeCombo->addItems({"panorama", "object360", "stl", "xr"});
    m_sourceEdit = new QLineEdit(inspector);
    m_sourceEdit->setReadOnly(true);
    m_yawSpin = angleSpin(-360.0, 360.0, 1.0, inspector);
    m_pitchSpin = angleSpin(-89.0, 89.0, 1.0, inspector);
    m_fovSpin = angleSpin(25.0, 120.0, 2.0, inspector);

    form->addRow(QStringLiteral("Название"), m_titleEdit);
    form->addRow(QStringLiteral("Тип"), m_typeCombo);
    form->addRow(QStringLiteral("Asset"), m_sourceEdit);
    form->addRow(QStringLiteral("Yaw"), m_yawSpin);
    form->addRow(QStringLiteral("Pitch"), m_pitchSpin);
    form->addRow(QStringLiteral("FOV"), m_fovSpin);
    inspectorLayout->addLayout(form);

    m_hotspotCount = new QLabel(QStringLiteral("Hotspot: 0"), inspector);
    inspectorLayout->addWidget(m_hotspotCount);

    auto *applyButton = new QPushButton(QStringLiteral("Применить свойства"), inspector);
    inspectorLayout->addWidget(applyButton);

    auto *addHotspot = new QPushButton(QStringLiteral("+ Hotspot в центре взгляда"), inspector);
    inspectorLayout->addWidget(addHotspot);
    inspectorLayout->addStretch(1);

    m_statusLabel = new QLabel(QStringLiteral("Нет сцены"), inspector);
    m_statusLabel->setWordWrap(true);
    m_statusLabel->setStyleSheet("color:#7fe2d2;");
    inspectorLayout->addWidget(m_statusLabel);

    splitter->addWidget(scenePanel);
    splitter->addWidget(centerPanel);
    splitter->addWidget(inspector);
    splitter->setStretchFactor(0, 0);
    splitter->setStretchFactor(1, 1);
    splitter->setStretchFactor(2, 0);
    splitter->setSizes({230, 950, 300});
    setCentralWidget(splitter);

    connect(m_sceneList, &QListWidget::currentRowChanged, this, &MainWindow::sceneSelectionChanged);
    connect(addScene, &QPushButton::clicked, this, &MainWindow::addEmptyScene);
    connect(removeScene, &QPushButton::clicked, this, &MainWindow::removeCurrentScene);
    connect(applyButton, &QPushButton::clicked, this, &MainWindow::applyInspector);
    connect(addHotspot, &QPushButton::clicked, this, [this] {
        addHotspotAtView(m_view->yaw(), m_view->pitch());
    });
    connect(m_view, &PanoramaView::viewChanged, this, &MainWindow::onViewChanged);
    connect(m_view, &PanoramaView::hotspotRequested, this, &MainWindow::addHotspotAtView);
}

void MainWindow::buildMenus() {
    auto *file = menuBar()->addMenu(QStringLiteral("&Файл"));
    auto *newAction = file->addAction(QStringLiteral("Новый проект…"));
    newAction->setShortcut(QKeySequence::New);
    auto *openAction = file->addAction(QStringLiteral("Открыть…"));
    openAction->setShortcut(QKeySequence::Open);
    auto *saveAction = file->addAction(QStringLiteral("Сохранить"));
    saveAction->setShortcut(QKeySequence::Save);
    file->addSeparator();
    auto *exportAction = file->addAction(QStringLiteral("Экспорт .player.zip…"));
    file->addSeparator();
    auto *exitAction = file->addAction(QStringLiteral("Выход"));

    auto *assets = menuBar()->addMenu(QStringLiteral("&Assets"));
    auto *panoramaAction = assets->addAction(QStringLiteral("Импорт 360° панорамы…"));

    auto *toolbar = addToolBar(QStringLiteral("Основное"));
    toolbar->setMovable(false);
    toolbar->addAction(newAction);
    toolbar->addAction(openAction);
    toolbar->addAction(saveAction);
    toolbar->addSeparator();
    toolbar->addAction(panoramaAction);
    toolbar->addSeparator();
    toolbar->addAction(exportAction);

    connect(newAction, &QAction::triggered, this, &MainWindow::newProject);
    connect(openAction, &QAction::triggered, this, &MainWindow::openProject);
    connect(saveAction, &QAction::triggered, this, &MainWindow::saveProject);
    connect(exportAction, &QAction::triggered, this, &MainWindow::exportPlayer);
    connect(exitAction, &QAction::triggered, this, &QWidget::close);
    connect(panoramaAction, &QAction::triggered, this, &MainWindow::importPanorama);
}

void MainWindow::newProject() {
    if (!maybeSave()) return;

    const QString fileName = QFileDialog::getSaveFileName(
        this,
        QStringLiteral("Новый проект 3DPL"),
        QStringLiteral("tour.3dpl"),
        QStringLiteral("3DPL Project (*.3dpl)")
    );
    if (fileName.isEmpty()) return;

    bool ok = false;
    const QString title = QInputDialog::getText(
        this,
        QStringLiteral("Название"),
        QStringLiteral("Название тура:"),
        QLineEdit::Normal,
        QFileInfo(fileName).completeBaseName(),
        &ok
    );
    if (!ok) return;

    QString error;
    if (!m_project.createNew(fileName, title, &error)) {
        showError(QStringLiteral("Создание проекта"), error);
        return;
    }

    m_dirty = false;
    refreshSceneList();
    m_view->clearImage();
    updateWindowTitle();
    statusBar()->showMessage(QStringLiteral("Проект создан"), 3000);
}

void MainWindow::openProject() {
    if (!maybeSave()) return;
    const QString fileName = QFileDialog::getOpenFileName(
        this,
        QStringLiteral("Открыть проект"),
        {},
        QStringLiteral("3DPL Project (*.3dpl)")
    );
    if (!fileName.isEmpty()) openProjectFile(fileName);
}

void MainWindow::openProjectFile(const QString &fileName) {
    if (!maybeSave()) return;

    QString error;
    if (!m_project.load(fileName, &error)) {
        showError(QStringLiteral("Открытие проекта"), error);
        return;
    }
    m_dirty = false;
    refreshSceneList(m_project.scenes().isEmpty() ? QString() : m_project.scenes().first().id);
    updateWindowTitle();
    statusBar()->showMessage(QStringLiteral("Проект открыт"), 3000);
}

void MainWindow::saveProject() {
    applyInspector();
    QString error;
    if (!m_project.save(&error)) {
        showError(QStringLiteral("Сохранение"), error);
        return;
    }
    m_dirty = false;
    updateWindowTitle();
    statusBar()->showMessage(QStringLiteral("Сохранено"), 2000);
}

void MainWindow::exportPlayer() {
    if (m_project.projectFile().isEmpty()) {
        showError(QStringLiteral("Экспорт"), QStringLiteral("Сначала создайте проект"));
        return;
    }
    saveProject();

    const QString path = QFileDialog::getSaveFileName(
        this,
        QStringLiteral("Экспорт для Player"),
        QDir(m_project.projectDir()).filePath(m_project.title() + ".player.zip"),
        QStringLiteral("Player Package (*.player.zip *.zip)")
    );
    if (path.isEmpty()) return;

    QString error;
    if (!m_project.exportPlayerZip(path, &error)) {
        showError(QStringLiteral("Экспорт"), error);
        return;
    }
    QMessageBox::information(
        this,
        QStringLiteral("Экспорт завершён"),
        QStringLiteral("Создан пакет:\n%1\n\nЕго уже понимает OpenXRPlayer.").arg(path)
    );
}

void MainWindow::importPanorama() {
    if (m_project.projectFile().isEmpty()) {
        showError(QStringLiteral("Импорт"), QStringLiteral("Сначала создайте или откройте проект"));
        return;
    }

    const QString fileName = QFileDialog::getOpenFileName(
        this,
        QStringLiteral("Импорт 360° панорамы"),
        {},
        QStringLiteral("Images (*.jpg *.jpeg *.png *.webp)")
    );
    if (fileName.isEmpty()) return;

    QString error;
    const QString id = m_project.addPanorama(fileName, &error);
    if (id.isEmpty()) {
        showError(QStringLiteral("Импорт"), error);
        return;
    }
    refreshSceneList(id);
    setProjectDirty(true);
}

void MainWindow::addEmptyScene() {
    if (m_project.projectFile().isEmpty()) return;
    bool ok = false;
    const QString title = QInputDialog::getText(
        this,
        QStringLiteral("Новая сцена"),
        QStringLiteral("Название:"),
        QLineEdit::Normal,
        QStringLiteral("Новая сцена"),
        &ok
    );
    if (!ok) return;
    const QString id = m_project.addScene("panorama", title);
    refreshSceneList(id);
}

void MainWindow::removeCurrentScene() {
    const QString id = currentSceneId();
    if (id.isEmpty()) return;
    if (QMessageBox::question(
            this,
            QStringLiteral("Удалить сцену"),
            QStringLiteral("Удалить выбранную сцену из проекта?")
        ) != QMessageBox::Yes) {
        return;
    }
    m_project.removeScene(id);
    refreshSceneList();
    m_view->clearImage();
}

QString MainWindow::currentSceneId() const {
    const auto *item = m_sceneList->currentItem();
    return item ? item->data(Qt::UserRole).toString() : QString();
}

Scene* MainWindow::currentScene() {
    return m_project.sceneById(currentSceneId());
}

void MainWindow::refreshSceneList(const QString &selectId) {
    m_updatingUi = true;
    m_sceneList->clear();

    int selectRow = -1;
    int row = 0;
    for (const Scene &s : m_project.scenes()) {
        auto *item = new QListWidgetItem(
            QStringLiteral("%1\n%2").arg(s.title, s.type),
            m_sceneList
        );
        item->setData(Qt::UserRole, s.id);
        if (s.id == selectId) selectRow = row;
        ++row;
    }
    m_updatingUi = false;

    if (selectRow < 0 && m_sceneList->count() > 0) selectRow = 0;
    if (selectRow >= 0) m_sceneList->setCurrentRow(selectRow);
}

void MainWindow::sceneSelectionChanged() {
    if (m_updatingUi) return;
    loadSceneIntoEditor(currentSceneId());
}

void MainWindow::loadSceneIntoEditor(const QString &id) {
    const Scene *scene = m_project.sceneById(id);
    m_updatingUi = true;
    if (!scene) {
        m_titleEdit->clear();
        m_sourceEdit->clear();
        m_hotspotCount->setText(QStringLiteral("Hotspot: 0"));
        m_statusLabel->setText(QStringLiteral("Нет сцены"));
        m_view->clearImage();
        m_updatingUi = false;
        return;
    }

    m_titleEdit->setText(scene->title);
    const int typeIndex = m_typeCombo->findText(scene->type);
    if (typeIndex >= 0) m_typeCombo->setCurrentIndex(typeIndex);
    m_sourceEdit->setText(scene->source);
    m_yawSpin->setValue(scene->yaw);
    m_pitchSpin->setValue(scene->pitch);
    m_fovSpin->setValue(scene->fov);
    m_hotspotCount->setText(QStringLiteral("Hotspot: %1").arg(scene->hotspots.size()));

    m_view->setView(scene->yaw, scene->pitch, scene->fov);
    if (scene->type == "panorama" && !scene->source.isEmpty()) {
        const QString path = m_project.assetAbsolutePath(scene->source);
        if (!m_view->loadImage(path)) {
            m_statusLabel->setText(QStringLiteral("Не удалось открыть панораму:\n%1").arg(path));
        } else {
            m_statusLabel->setText(QStringLiteral("Native OpenGL panorama"));
        }
    } else {
        m_view->clearImage();
        m_statusLabel->setText(
            QStringLiteral("Тип %1 уже есть в модели проекта; нативный viewport переносится следующим модулем.")
                .arg(scene->type)
        );
    }
    m_updatingUi = false;
}

void MainWindow::applyInspector() {
    if (m_updatingUi) return;
    Scene *scene = currentScene();
    if (!scene) return;

    scene->title = m_titleEdit->text().trimmed();
    scene->type = m_typeCombo->currentText();
    scene->yaw = m_yawSpin->value();
    scene->pitch = m_pitchSpin->value();
    scene->fov = m_fovSpin->value();

    m_view->setView(scene->yaw, scene->pitch, scene->fov);
    setProjectDirty(true);
    refreshSceneList(scene->id);
}

void MainWindow::onViewChanged(double yaw, double pitch, double fov) {
    if (m_updatingUi) return;
    Scene *scene = currentScene();
    if (!scene) return;

    scene->yaw = yaw;
    scene->pitch = pitch;
    scene->fov = fov;

    m_updatingUi = true;
    m_yawSpin->setValue(yaw);
    m_pitchSpin->setValue(pitch);
    m_fovSpin->setValue(fov);
    m_updatingUi = false;

    setProjectDirty(true);
}

void MainWindow::addHotspotAtView(double yaw, double pitch) {
    Scene *scene = currentScene();
    if (!scene) return;

    Hotspot h;
    h.id = QUuid::createUuid().toString(QUuid::WithoutBraces);
    h.yaw = yaw;
    h.pitch = pitch;

    QStringList targets;
    QVector<QString> targetIds;
    for (const Scene &s : m_project.scenes()) {
        if (s.id == scene->id) continue;
        targets << s.title;
        targetIds << s.id;
    }

    if (!targets.isEmpty()) {
        bool ok = false;
        const QString selected = QInputDialog::getItem(
            this,
            QStringLiteral("Hotspot перехода"),
            QStringLiteral("Перейти в сцену:"),
            targets,
            0,
            false,
            &ok
        );
        if (!ok) return;
        const int index = targets.indexOf(selected);
        if (index >= 0) {
            h.type = "scene";
            h.text = selected;
            h.targetSceneId = targetIds[index];
        }
    } else {
        h.type = "info";
        h.text = QStringLiteral("Hotspot");
        h.info = QStringLiteral("Информационная точка");
    }

    scene->hotspots.push_back(h);
    m_hotspotCount->setText(QStringLiteral("Hotspot: %1").arg(scene->hotspots.size()));
    setProjectDirty(true);
    statusBar()->showMessage(
        QStringLiteral("Hotspot добавлен: yaw %1°, pitch %2°")
            .arg(yaw, 0, 'f', 1)
            .arg(pitch, 0, 'f', 1),
        4000
    );
}

void MainWindow::setProjectDirty(bool dirty) {
    if (m_project.projectFile().isEmpty()) dirty = false;
    m_dirty = dirty;
    updateWindowTitle();
}

void MainWindow::updateWindowTitle() {
    QString title = QStringLiteral("3DPL Studio");
    if (!m_project.projectFile().isEmpty()) {
        title += QStringLiteral(" — ") + m_project.title();
        if (m_dirty) title += " *";
    }
    setWindowTitle(title);
}

bool MainWindow::maybeSave() {
    if (!m_dirty) return true;
    const auto result = QMessageBox::question(
        this,
        QStringLiteral("Несохранённые изменения"),
        QStringLiteral("Сохранить изменения проекта?"),
        QMessageBox::Save | QMessageBox::Discard | QMessageBox::Cancel
    );
    if (result == QMessageBox::Cancel) return false;
    if (result == QMessageBox::Save) {
        saveProject();
        return !m_dirty;
    }
    return true;
}

void MainWindow::showError(const QString &title, const QString &text) {
    QMessageBox::critical(this, title, text);
}

void MainWindow::closeEvent(QCloseEvent *event) {
    if (maybeSave()) event->accept();
    else event->ignore();
}
