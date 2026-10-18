#pragma once

#include "model/Project.h"

#include <QMainWindow>
#include <QUndoStack>

class PanoramaViewport;
class QListWidget;
class QLineEdit;
class QComboBox;
class QDoubleSpinBox;
class QSpinBox;
class QTableWidget;
class QLabel;
class QTimer;
class QStackedWidget;
class QPushButton;

class MainWindow final : public QMainWindow {
    Q_OBJECT

public:
    explicit MainWindow(QWidget* parent = nullptr);

protected:
    void closeEvent(QCloseEvent* event) override;

private:
    void buildUi();
    void buildMenus();
    QWidget* buildLeftPanel();
    QWidget* buildRightPanel();
    QWidget* buildProjectPage();
    QWidget* buildScenePage();

    void newProject();
    void openProject();
    void saveProject();
    void saveProjectAs();
    bool saveCurrent(bool showErrors = true);

    void addPanorama();
    void addXr();
    void addStl();
    void addObject360();
    void deleteCurrentScene();

    void refreshAll();
    void refreshSceneList();
    void refreshProjectControls();
    void refreshSceneControls();
    void refreshHotspots();
    void selectScene(const QString& id);
    void loadCurrentSceneIntoViewport();

    Scene* currentScene();
    const Scene* currentScene() const;

    QString uniqueSceneId(const QString& prefix) const;
    QString sceneTypeLabel(SceneType type) const;
    QString categoryForScene(SceneType type) const;

    void markDirty();
    void scheduleAutosave();
    void addHotspot(double yaw, double pitch);
    void addObjectHotspot(double xPercent, double yPercent, int sector, int row);
    void deleteSelectedHotspot();

    void setProjectTitle(const QString& value);
    void setSceneTitle(const QString& value);
    void setSceneYaw(double value);
    void setScenePitch(double value);
    void setSceneFov(double value);
    void setSceneProjection(const QString& value);

    Project m_project;
    QString m_projectDir;
    QString m_currentSceneId;
    bool m_dirty = false;
    bool m_refreshing = false;

    QUndoStack m_undoStack;
    QTimer* m_autosaveTimer = nullptr;

    QListWidget* m_sceneList = nullptr;
    PanoramaViewport* m_viewport = nullptr;
    QLabel* m_status = nullptr;
    QLabel* m_sceneTypeBadge = nullptr;
    QStackedWidget* m_rightStack = nullptr;

    QLineEdit* m_projectTitle = nullptr;
    QComboBox* m_firstScene = nullptr;

    QLineEdit* m_sceneTitle = nullptr;
    QLineEdit* m_sceneId = nullptr;
    QDoubleSpinBox* m_sceneYaw = nullptr;
    QDoubleSpinBox* m_scenePitch = nullptr;
    QDoubleSpinBox* m_sceneFov = nullptr;
    QComboBox* m_sceneProjection = nullptr;
    QLabel* m_sceneSource = nullptr;

    QTableWidget* m_hotspotTable = nullptr;
    QPushButton* m_deleteHotspot = nullptr;
};
