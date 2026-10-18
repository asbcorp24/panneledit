#pragma once

#include <QMainWindow>

class QListWidget;
class QLineEdit;
class QLabel;
class QTimer;
class QAction;
class ProjectDocument;
class PanoramaViewport;
class SceneInspector;

class MainWindow final : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget* parent = nullptr);
    bool openProject(const QString& fileName);

protected:
    void closeEvent(QCloseEvent* event) override;

private:
    void buildUi();
    void buildMenus();
    void applyTheme();
    void refreshWindowTitle();
    void refreshSceneList();
    void refreshCurrentScene(bool keepView = false);
    void setCurrentScene(int index);
    void newProject();
    void chooseOpenProject();
    void saveProject();
    void saveProjectAs();
    void addPanorama();
    void addGenericScene(const QString& type);
    void deleteCurrentScene();
    void addHotspotAt(double yaw, double pitch);
    bool maybeSave();
    void showError(const QString& title, const QString& message);
    void updateStatus();

    ProjectDocument* m_document = nullptr;
    PanoramaViewport* m_viewport = nullptr;
    SceneInspector* m_inspector = nullptr;
    QListWidget* m_sceneList = nullptr;
    QLineEdit* m_projectTitle = nullptr;
    QLabel* m_status = nullptr;
    QTimer* m_autosave = nullptr;

    int m_currentScene = -1;
    bool m_refreshing = false;
};
