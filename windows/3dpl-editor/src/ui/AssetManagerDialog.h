#pragma once

#include "model/Project.h"

#include <QDialog>
#include <QSet>

class QTableWidget;
class QLabel;
class QPushButton;

class AssetManagerDialog final : public QDialog {
    Q_OBJECT
public:
    AssetManagerDialog(
        const Project& project,
        const QString& projectDirectory,
        QWidget* parent = nullptr
    );

private:
    void buildUi();
    void refresh();
    void deleteUnused();
    void deleteSelected();
    void openSelectedFolder();

    QSet<QString> collectReferences() const;
    QString normalizedRelative(const QString& path) const;
    bool isInsideAssets(const QString& relative) const;

    const Project& m_project;
    QString m_projectDirectory;

    QTableWidget* m_table = nullptr;
    QLabel* m_summary = nullptr;
    QPushButton* m_deleteUnused = nullptr;
    QPushButton* m_deleteSelected = nullptr;
};
