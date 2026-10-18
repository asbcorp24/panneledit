#include "ProjectModel.h"
#include "ZipWriter.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QRandomGenerator>
#include <QUuid>

ProjectModel::ProjectModel(QObject *parent) : QObject(parent) {}

QString ProjectModel::projectDir() const {
    return QFileInfo(m_projectFile).absolutePath();
}

void ProjectModel::setTitle(const QString &title) {
    if (m_title == title) return;
    m_title = title;
    emit changed();
}

QString ProjectModel::uniqueSceneId() const {
    return QUuid::createUuid().toString(QUuid::WithoutBraces);
}

bool ProjectModel::createNew(const QString &projectFile, const QString &title, QString *error) {
    m_projectFile = QFileInfo(projectFile).absoluteFilePath();
    m_title = title.trimmed().isEmpty() ? QStringLiteral("Новый тур") : title.trimmed();
    m_firstScene.clear();
    m_scenes.clear();

    QDir dir(projectDir());
    if (!dir.exists() && !QDir().mkpath(dir.absolutePath())) {
        if (error) *error = QStringLiteral("Не удалось создать папку проекта");
        return false;
    }
    dir.mkpath("assets/panoramas");
    dir.mkpath("assets/object360");
    dir.mkpath("assets/stl");
    dir.mkpath("assets/video");
    dir.mkpath("assets/audio");
    dir.mkpath("multires");
    dir.mkpath("cache");
    dir.mkpath("thumbnails");
    return save(error);
}

QJsonObject ProjectModel::toJson() const {
    QJsonArray scenes;
    for (const Scene &scene : m_scenes) {
        QJsonArray hotspots;
        for (const Hotspot &h : scene.hotspots) {
            hotspots.append(QJsonObject{
                {"id", h.id},
                {"type", h.type},
                {"text", h.text},
                {"targetSceneId", h.targetSceneId},
                {"url", h.url},
                {"info", h.info},
                {"yaw", h.yaw},
                {"pitch", h.pitch}
            });
        }
        scenes.append(QJsonObject{
            {"id", scene.id},
            {"title", scene.title},
            {"type", scene.type},
            {"source", scene.source},
            {"yaw", scene.yaw},
            {"pitch", scene.pitch},
            {"fov", scene.fov},
            {"hotspots", hotspots}
        });
    }

    return QJsonObject{
        {"format", "3dpl-project"},
        {"version", 1},
        {"title", m_title},
        {"firstScene", m_firstScene},
        {"scenes", scenes}
    };
}

bool ProjectModel::fromJson(const QJsonObject &root, QString *error) {
    if (root.value("format").toString() != "3dpl-project") {
        if (error) *error = QStringLiteral("Это не проект 3DPL Studio");
        return false;
    }
    if (root.value("version").toInt() != 1) {
        if (error) *error = QStringLiteral("Версия проекта пока не поддерживается");
        return false;
    }

    QVector<Scene> loaded;
    const QJsonArray scenes = root.value("scenes").toArray();
    for (const QJsonValue &v : scenes) {
        const QJsonObject o = v.toObject();
        Scene s;
        s.id = o.value("id").toString();
        s.title = o.value("title").toString();
        s.type = o.value("type").toString("panorama");
        s.source = o.value("source").toString();
        s.yaw = o.value("yaw").toDouble();
        s.pitch = o.value("pitch").toDouble();
        s.fov = o.value("fov").toDouble(100.0);
        if (s.id.isEmpty()) s.id = uniqueSceneId();
        if (s.title.isEmpty()) s.title = s.id;

        for (const QJsonValue &hv : o.value("hotspots").toArray()) {
            const QJsonObject ho = hv.toObject();
            Hotspot h;
            h.id = ho.value("id").toString();
            h.type = ho.value("type").toString("scene");
            h.text = ho.value("text").toString();
            h.targetSceneId = ho.value("targetSceneId").toString();
            h.url = ho.value("url").toString();
            h.info = ho.value("info").toString();
            h.yaw = ho.value("yaw").toDouble();
            h.pitch = ho.value("pitch").toDouble();
            if (h.id.isEmpty()) h.id = QUuid::createUuid().toString(QUuid::WithoutBraces);
            s.hotspots.push_back(h);
        }
        loaded.push_back(s);
    }

    m_title = root.value("title").toString("Новый тур");
    m_firstScene = root.value("firstScene").toString();
    m_scenes = loaded;
    if (m_firstScene.isEmpty() && !m_scenes.isEmpty()) m_firstScene = m_scenes.first().id;
    emit changed();
    return true;
}

bool ProjectModel::load(const QString &projectFile, QString *error) {
    QFile file(projectFile);
    if (!file.open(QIODevice::ReadOnly)) {
        if (error) *error = file.errorString();
        return false;
    }
    QJsonParseError parse;
    const QJsonDocument doc = QJsonDocument::fromJson(file.readAll(), &parse);
    if (parse.error != QJsonParseError::NoError || !doc.isObject()) {
        if (error) *error = parse.errorString();
        return false;
    }
    m_projectFile = QFileInfo(projectFile).absoluteFilePath();
    return fromJson(doc.object(), error);
}

bool ProjectModel::save(QString *error) {
    if (m_projectFile.isEmpty()) {
        if (error) *error = QStringLiteral("Файл проекта не выбран");
        return false;
    }
    QFile file(m_projectFile);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        if (error) *error = file.errorString();
        return false;
    }
    if (file.write(QJsonDocument(toJson()).toJson(QJsonDocument::Indented)) < 0) {
        if (error) *error = file.errorString();
        return false;
    }
    return true;
}

int ProjectModel::sceneIndex(const QString &id) const {
    for (int i = 0; i < m_scenes.size(); ++i)
        if (m_scenes[i].id == id) return i;
    return -1;
}

Scene* ProjectModel::sceneById(const QString &id) {
    const int i = sceneIndex(id);
    return i >= 0 ? &m_scenes[i] : nullptr;
}

const Scene* ProjectModel::sceneById(const QString &id) const {
    const int i = sceneIndex(id);
    return i >= 0 ? &m_scenes[i] : nullptr;
}

QString ProjectModel::copyAsset(const QString &sourceFile, const QString &category, QString *error) {
    QFileInfo src(sourceFile);
    if (!src.isFile()) {
        if (error) *error = QStringLiteral("Исходный файл не найден");
        return {};
    }
    QDir dir(projectDir());
    const QString targetDir = QStringLiteral("assets/") + category;
    dir.mkpath(targetDir);

    QString base = src.completeBaseName();
    QString ext = src.suffix().toLower();
    QString name = base + "." + ext;
    int suffix = 1;
    while (QFileInfo::exists(dir.filePath(targetDir + "/" + name))) {
        name = base + "_" + QString::number(++suffix) + "." + ext;
    }
    const QString relative = targetDir + "/" + name;
    const QString target = dir.filePath(relative);
    if (!QFile::copy(sourceFile, target)) {
        if (error) *error = QStringLiteral("Не удалось скопировать asset");
        return {};
    }
    return relative;
}

QString ProjectModel::addScene(const QString &type, const QString &title) {
    Scene s;
    s.id = uniqueSceneId();
    s.type = type;
    s.title = title.isEmpty() ? type : title;
    m_scenes.push_back(s);
    if (m_firstScene.isEmpty()) m_firstScene = s.id;
    emit changed();
    return s.id;
}

QString ProjectModel::addPanorama(const QString &sourceFile, QString *error) {
    const QString relative = copyAsset(sourceFile, "panoramas", error);
    if (relative.isEmpty()) return {};
    Scene s;
    s.id = uniqueSceneId();
    s.type = "panorama";
    s.title = QFileInfo(sourceFile).completeBaseName();
    s.source = relative;
    s.fov = 100.0;
    m_scenes.push_back(s);
    if (m_firstScene.isEmpty()) m_firstScene = s.id;
    emit changed();
    return s.id;
}

bool ProjectModel::removeScene(const QString &id) {
    const int i = sceneIndex(id);
    if (i < 0) return false;
    m_scenes.remove(i);
    if (m_firstScene == id) m_firstScene = m_scenes.isEmpty() ? QString() : m_scenes.first().id;
    emit changed();
    return true;
}

QString ProjectModel::assetAbsolutePath(const QString &relative) const {
    return QDir(projectDir()).filePath(relative);
}

QJsonObject ProjectModel::openXrManifest() const {
    QJsonArray scenes;
    for (const Scene &s : m_scenes) {
        QJsonArray hotspots;
        for (const Hotspot &h : s.hotspots) {
            hotspots.append(QJsonObject{
                {"id", h.id}, {"type", h.type}, {"text", h.text},
                {"targetSceneId", h.targetSceneId}, {"url", h.url}, {"info", h.info},
                {"yaw", h.yaw}, {"pitch", h.pitch}
            });
        }
        QJsonObject scene{
            {"id", s.id}, {"title", s.title}, {"type", s.type},
            {"source", s.source}, {"yaw", s.yaw}, {"pitch", s.pitch},
            {"fov", s.fov}, {"hotspots", hotspots}
        };
        if (s.type == "panorama") scene.insert("projection", "360");
        scenes.append(scene);
    }
    QJsonArray order;
    for (const Scene &s : m_scenes) order.append(s.id);

    return QJsonObject{
        {"format", "xr-tour-openxr"},
        {"version", 1},
        {"title", m_title},
        {"firstScene", m_firstScene},
        {"sceneOrder", order},
        {"scenes", scenes}
    };
}

bool ProjectModel::exportPlayerZip(const QString &zipPath, QString *error) const {
    if (m_scenes.isEmpty()) {
        if (error) *error = QStringLiteral("В проекте нет сцен");
        return false;
    }

    ZipWriter zip(zipPath);
    if (!zip.isOpen()) {
        if (error) *error = zip.errorString();
        return false;
    }

    const QByteArray manifest = QJsonDocument(openXrManifest()).toJson(QJsonDocument::Indented);
    if (!zip.addFile("openxr-manifest.json", manifest)) {
        if (error) *error = zip.errorString();
        return false;
    }

    const QJsonObject playerManifest{
        {"format", "xr-tour-player"},
        {"version", 1},
        {"title", m_title},
        {"openxrManifest", "openxr-manifest.json"},
        {"nativeDesktopEditor", true}
    };
    if (!zip.addFile("player-manifest.json",
                     QJsonDocument(playerManifest).toJson(QJsonDocument::Indented))) {
        if (error) *error = zip.errorString();
        return false;
    }

    for (const Scene &s : m_scenes) {
        if (s.source.isEmpty()) continue;
        const QString disk = assetAbsolutePath(s.source);
        if (!QFileInfo::exists(disk)) continue;
        if (!zip.addFileFromDisk(s.source, disk)) {
            if (error) *error = zip.errorString();
            return false;
        }
    }

    if (!zip.close()) {
        if (error) *error = zip.errorString();
        return false;
    }
    return true;
}
