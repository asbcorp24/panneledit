#pragma once

#include "model/Scene.h"
#include "model/Project.h"

#include <QDialog>

class QTableWidget;

class SceneObjectsDialog final : public QDialog {
    Q_OBJECT
public:
    SceneObjectsDialog(
        Scene scene,
        const Project& project,
        const QString& projectDirectory,
        QWidget* parent = nullptr
    );

    Scene resultScene() const { return m_scene; }

private:
    void buildUi();
    void refreshTables();

    void addText();
    void editText();
    void deleteText();

    void addMedia();
    void editMedia();
    void deleteMedia();

    QJsonObject editTextObject(const QJsonObject& input, bool* ok);
    QJsonObject editMediaObject(const QJsonObject& input, bool* ok);

    Scene m_scene;
    Project m_project;
    QString m_projectDirectory;

    QTableWidget* m_textTable = nullptr;
    QTableWidget* m_mediaTable = nullptr;
};
