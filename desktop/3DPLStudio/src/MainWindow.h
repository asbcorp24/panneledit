#pragma once

#include <QMainWindow>
#include <QUndoStack>

#include "ProjectModel.h"

class QListWidget;
class QLineEdit;
class QComboBox;
class QDoubleSpinBox;
class QLabel;
class QPushButton;
class PanoramaView;

class MainWindow final : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget *parent = nullptr);
    void openProjectFile(const QString &fileName);

protected:
    void closeEvent(QCloseEvent *event) override;

private slots:
    void newProject();
    void openProject();
    void saveProject();
    void exportPlayer();
    void importPanorama();
    void addEmptyScene();
    void removeCurrentScene();
    void sceneSelectionChanged();
    void applyInspector();
    void onViewChanged(double yaw, double pitch, double fov);
    void addHotspotAtView(double yaw, double pitch);

private:
    void buildUi();
    void buildMenus();
    void applyDarkPalette();
    void refreshSceneList(const QString &selectId = {});
    void loadSceneIntoEditor(const QString &id);
    void updateWindowTitle();
    void setProjectDirty(bool dirty);
    bool maybeSave();
    Scene* currentScene();
    QString currentSceneId() const;
    void showError(const QString &title, const QString &text);

    ProjectModel m_project;
    bool m_dirty = false;
    bool m_updatingUi = false;

    QListWidget *m_sceneList = nullptr;
    PanoramaView *m_view = nullptr;

    QLineEdit *m_titleEdit = nullptr;
    QComboBox *m_typeCombo = nullptr;
    QLineEdit *m_sourceEdit = nullptr;
    QDoubleSpinBox *m_yawSpin = nullptr;
    QDoubleSpinBox *m_pitchSpin = nullptr;
    QDoubleSpinBox *m_fovSpin = nullptr;
    QLabel *m_statusLabel = nullptr;
    QLabel *m_hotspotCount = nullptr;

    QUndoStack m_undo;
};
