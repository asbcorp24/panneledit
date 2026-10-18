#pragma once

#include <QObject>
#include <QJsonObject>
#include <QJsonArray>
#include <QImage>
#include <QStringList>

class ProjectDocument final : public QObject {
    Q_OBJECT
public:
    explicit ProjectDocument(QObject* parent = nullptr);

    bool createNew(const QString& directory, QString* error = nullptr);
    bool load(const QString& fileName, QString* error = nullptr);
    bool save(QString* error = nullptr);
    bool saveAs(const QString& fileName, QString* error = nullptr);
    bool autosave(QString* error = nullptr) const;

    bool isLoaded() const { return !m_fileName.isEmpty(); }
    bool isDirty() const { return m_dirty; }
    QString fileName() const { return m_fileName; }
    QString baseDir() const;
    QString title() const;
    void setTitle(const QString& title);

    int sceneCount() const;
    QJsonObject sceneAt(int index) const;
    QJsonObject sceneById(const QString& id) const;
    int sceneIndexById(const QString& id) const;

    bool updateScene(int index, const QJsonObject& scene);
    bool removeScene(int index);
    int addPanorama(const QString& sourceFile, QString* error = nullptr);
    int addGenericScene(const QString& type, const QString& title);
    bool addHotspot(int sceneIndex, double yaw, double pitch, const QString& type = QStringLiteral("info"));
    bool removeHotspot(int sceneIndex, int hotspotIndex);

    QString resolveAsset(const QString& value) const;
    QImage loadImageValue(const QString& value) const;
    QString sceneImageValue(const QJsonObject& scene) const;

    QJsonObject rootObject() const { return m_root; }
    void setRootObject(const QJsonObject& root);

    static QJsonObject emptyProject();
    static QString sceneType(const QJsonObject& scene);
    static QString makeId(const QString& prefix);

Q_SIGNALS:
    void documentChanged();
    void dirtyChanged(bool dirty);
    void scenesChanged();

private:
    void setDirty(bool dirty);
    bool writeTo(const QString& fileName, QString* error) const;
    QString importAsset(const QString& sourceFile, const QString& category, QString* error);
    QJsonArray scenesArray() const;
    void setScenesArray(const QJsonArray& scenes);

    QString m_fileName;
    QJsonObject m_root;
    bool m_dirty = false;
};
