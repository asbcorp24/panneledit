#pragma once

#include <QObject>
#include <QJsonObject>
#include <QString>
#include <QVector>

struct Hotspot {
    QString id;
    QString type = "scene";
    QString text;
    QString targetSceneId;
    QString url;
    QString info;
    double yaw = 0.0;
    double pitch = 0.0;
};

struct Scene {
    QString id;
    QString title;
    QString type = "panorama";
    QString source;
    double yaw = 0.0;
    double pitch = 0.0;
    double fov = 100.0;
    QVector<Hotspot> hotspots;
};

class ProjectModel final : public QObject {
    Q_OBJECT
public:
    explicit ProjectModel(QObject *parent = nullptr);

    bool createNew(const QString &projectFile, const QString &title, QString *error = nullptr);
    bool load(const QString &projectFile, QString *error = nullptr);
    bool save(QString *error = nullptr);

    QString projectFile() const { return m_projectFile; }
    QString projectDir() const;
    QString title() const { return m_title; }
    void setTitle(const QString &title);

    const QVector<Scene>& scenes() const { return m_scenes; }
    QVector<Scene>& scenes() { return m_scenes; }

    int sceneIndex(const QString &id) const;
    Scene* sceneById(const QString &id);
    const Scene* sceneById(const QString &id) const;

    QString addPanorama(const QString &sourceFile, QString *error = nullptr);
    QString addScene(const QString &type, const QString &title);
    bool removeScene(const QString &id);

    QString assetAbsolutePath(const QString &relative) const;

    bool exportPlayerZip(const QString &zipPath, QString *error = nullptr) const;
    QJsonObject openXrManifest() const;

signals:
    void changed();

private:
    QJsonObject toJson() const;
    bool fromJson(const QJsonObject &root, QString *error);

    QString uniqueSceneId() const;
    QString copyAsset(const QString &sourceFile, const QString &category, QString *error);

    QString m_projectFile;
    QString m_title = "Новый тур";
    QString m_firstScene;
    QVector<Scene> m_scenes;
};
