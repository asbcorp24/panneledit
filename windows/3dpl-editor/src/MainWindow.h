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
class QCheckBox;
class QGroupBox;
class QMediaPlayer;
class QAudioOutput;
class QVideoSink;

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
    void importLegacyProject();
    void saveProject();
    void saveProjectAs();
    bool saveCurrent(bool showErrors = true);
    void exportOpenXrPackage();
    void editProjectOptions();
    void editSceneObjects();
    void editObjectAlignment();
    void manageAssets();
    void generateCurrentMultires();

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
    void startVideoPreview(const Scene& scene, const QString& filePath);
    void stopVideoPreview();

    Scene* currentScene();
    const Scene* currentScene() const;

    QString uniqueSceneId(const QString& prefix) const;
    QString sceneTypeLabel(SceneType type) const;
    QString categoryForScene(SceneType type) const;

    void markDirty();
    void scheduleAutosave();
    void addHotspot(double yaw, double pitch);
    void addObjectHotspot(double xPercent, double yPercent, int sector, int row);
    void moveHotspot(
        const QString& hotspotId,
        double yaw,
        double pitch,
        double xPercent,
        double yPercent,
        int sector,
        int row,
        bool objectMode
    );
    void deleteSelectedHotspot();
    void editSelectedHotspot();
    void chooseProjectMusic();
    void removeProjectMusic();
    void chooseSceneMusic();
    void removeSceneMusic();
    void chooseSceneNarration();
    void removeSceneNarration();

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
    QLabel* m_projectMusicName = nullptr;
    QSpinBox* m_projectMusicVolume = nullptr;
    QCheckBox* m_projectMusicLoop = nullptr;

    QLineEdit* m_sceneTitle = nullptr;
    QLineEdit* m_sceneId = nullptr;
    QDoubleSpinBox* m_sceneYaw = nullptr;
    QDoubleSpinBox* m_scenePitch = nullptr;
    QDoubleSpinBox* m_sceneFov = nullptr;
    QComboBox* m_sceneProjection = nullptr;
    QLabel* m_sceneSource = nullptr;

    QTableWidget* m_hotspotTable = nullptr;
    QPushButton* m_deleteHotspot = nullptr;

    QGroupBox* m_sceneAudioOptions = nullptr;
    QLabel* m_sceneMusicName = nullptr;
    QSpinBox* m_sceneMusicVolume = nullptr;
    QCheckBox* m_sceneMusicLoop = nullptr;
    QLabel* m_sceneNarrationName = nullptr;
    QSpinBox* m_sceneNarrationVolume = nullptr;

    QGroupBox* m_panoramaOptions = nullptr;
    QComboBox* m_multiresTileSize = nullptr;
    QSpinBox* m_multiresQuality = nullptr;
    QComboBox* m_multiresMaxCube = nullptr;
    QPushButton* m_generateMultires = nullptr;

    QGroupBox* m_objectOptions = nullptr;
    QSpinBox* m_objectStartSector = nullptr;
    QSpinBox* m_objectStartRow = nullptr;

    QGroupBox* m_stlOptions = nullptr;
    QDoubleSpinBox* m_stlZoom = nullptr;
    QCheckBox* m_stlWireframe = nullptr;
    QPushButton* m_stlColorButton = nullptr;

    QGroupBox* m_xrOptions = nullptr;
    QCheckBox* m_sceneAutoplay = nullptr;
    QCheckBox* m_sceneLoop = nullptr;
    QSpinBox* m_xrVolume = nullptr;

    QMediaPlayer* m_mediaPlayer = nullptr;
    QAudioOutput* m_audioOutput = nullptr;
    QVideoSink* m_videoSink = nullptr;
};
