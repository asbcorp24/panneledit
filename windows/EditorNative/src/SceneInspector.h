#pragma once

#include <QJsonObject>
#include <QWidget>

class QComboBox;
class QDoubleSpinBox;
class QLabel;
class QLineEdit;
class QListWidget;
class QPushButton;
class QStackedWidget;
class QTextEdit;

class SceneInspector final : public QWidget {
    Q_OBJECT
public:
    explicit SceneInspector(QWidget* parent = nullptr);

    void setScene(const QJsonObject& scene, int sceneIndex);
    void clearScene();
    void selectHotspot(int index);

Q_SIGNALS:
    void sceneChanged(int sceneIndex, const QJsonObject& scene);
    void hotspotSelectionChanged(int hotspotIndex);
    void deleteHotspotRequested(int sceneIndex, int hotspotIndex);

private:
    void buildUi();
    void refreshHotspots();
    void loadHotspot(int index);
    void commitScene();
    void commitHotspot();
    void setUpdating(bool updating) { m_updating = updating; }

    QJsonObject m_scene;
    int m_sceneIndex = -1;
    int m_hotspotIndex = -1;
    bool m_updating = false;

    QLabel* m_typeLabel = nullptr;
    QLineEdit* m_title = nullptr;
    QDoubleSpinBox* m_yaw = nullptr;
    QDoubleSpinBox* m_pitch = nullptr;
    QDoubleSpinBox* m_fov = nullptr;

    QListWidget* m_hotspots = nullptr;
    QComboBox* m_hotspotType = nullptr;
    QLineEdit* m_hotspotText = nullptr;
    QDoubleSpinBox* m_hotspotYaw = nullptr;
    QDoubleSpinBox* m_hotspotPitch = nullptr;
    QComboBox* m_targetScene = nullptr;
    QLineEdit* m_url = nullptr;
    QTextEdit* m_info = nullptr;
    QPushButton* m_deleteHotspot = nullptr;
};
