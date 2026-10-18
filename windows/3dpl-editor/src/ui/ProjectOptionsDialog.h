#pragma once

#include "model/Project.h"

#include <QDialog>

class QCheckBox;
class QComboBox;
class QLineEdit;
class QSpinBox;
class QTableWidget;
class QLabel;

class ProjectOptionsDialog final : public QDialog {
    Q_OBJECT
public:
    explicit ProjectOptionsDialog(
        Project project,
        const QString& projectDirectory,
        QWidget* parent = nullptr
    );

    Project resultProject() const { return m_project; }

private:
    void buildUi();
    void loadFromProject();
    void saveToProject();
    void chooseCover();
    void addGuideStep();
    void editGuideStep();
    void removeGuideStep();
    void refreshGuideTable();

    Project m_project;
    QString m_projectDirectory;
    QString m_coverSource;

    QCheckBox* m_startEnabled = nullptr;
    QLineEdit* m_startTitle = nullptr;
    QLineEdit* m_startSubtitle = nullptr;
    QLabel* m_coverLabel = nullptr;
    QCheckBox* m_allowSilent = nullptr;

    QCheckBox* m_guideEnabled = nullptr;
    QTableWidget* m_guideTable = nullptr;

    QCheckBox* m_fadeEnabled = nullptr;
    QSpinBox* m_fadeDuration = nullptr;
    QComboBox* m_defaultTransition = nullptr;
    QCheckBox* m_autoRotateEnabled = nullptr;
    QSpinBox* m_autoRotate = nullptr;

    QCheckBox* m_optimizeEnabled = nullptr;
    QSpinBox* m_jpegQuality = nullptr;
    QSpinBox* m_maxImageWidth = nullptr;
    QSpinBox* m_objectFrameWidth = nullptr;
    QCheckBox* m_pwaEnabled = nullptr;
    QCheckBox* m_kioskMode = nullptr;
    QLineEdit* m_publicUrl = nullptr;
};
