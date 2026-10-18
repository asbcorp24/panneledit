#include "ProjectDocument.h"

#include <QBuffer>
#include <QCryptographicHash>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QRandomGenerator>
#include <QRegularExpression>
#include <QSaveFile>
#include <QUuid>

ProjectDocument::ProjectDocument(QObject* parent)
    : QObject(parent), m_root(emptyProject()) {}

QJsonObject ProjectDocument::emptyProject() {
    QJsonObject root;
    root.insert("version", 10);
    root.insert("title", QString::fromUtf8("Виртуальная экскурсия"));
    root.insert("firstScene", QJsonValue::Null);
    root.insert("audio", QJsonObject{
        {"music", QJsonObject{{"data", ""}, {"filename", ""}, {"volume", 35}, {"loop", true}}}
    });
    root.insert("startScreen", QJsonObject{
        {"enabled", true},
        {"title", QString::fromUtf8("Виртуальная экскурсия")},
        {"subtitle", ""},
        {"coverData", ""},
        {"coverFilename", ""},
        {"allowSilent", true}
    });
    root.insert("guide", QJsonObject{{"enabled", false}, {"steps", QJsonArray{}}});
    root.insert("exportSettings", QJsonObject{
        {"optimizeEnabled", true}, {"jpegQuality", 84}, {"maxImageWidth", 4096},
        {"objectFrameWidth", 1280}, {"pwaEnabled", true}, {"kioskMode", false},
        {"publicUrl", ""}
    });
    root.insert("settings", QJsonObject{
        {"fadeEnabled", true}, {"fadeDuration", 900},
        {"autoRotateEnabled", false}, {"autoRotate", -2},
        {"multiresEnabled", true}, {"multiresTileSize", 512},
        {"multiresQuality", 85}, {"multiresMaxCubeSize", 4096},
        {"defaultTransition", "fade"}
    });
    root.insert("scenes", QJsonArray{});
    root.insert("nativeEditor", QJsonObject{
        {"format", "3dpl-native"}, {"version", 1}
    });
    return root;
}

QString ProjectDocument::makeId(const QString& prefix) {
    return prefix + "-" + QUuid::createUuid().toString(QUuid::WithoutBraces).left(8);
}

bool ProjectDocument::createNew(const QString& directory, QString* error) {
    QDir dir(directory);
    if (!dir.exists() && !dir.mkpath(".")) {
        if (error) *error = QString::fromUtf8("Не удалось создать папку проекта");
        return false;
    }
    for (const QString& sub : {
             QStringLiteral("assets/panoramas"),
             QStringLiteral("assets/object360"),
             QStringLiteral("assets/stl"),
             QStringLiteral("assets/xr"),
             QStringLiteral("assets/audio"),
             QStringLiteral("cache"),
             QStringLiteral("thumbnails"),
             QStringLiteral("multires")}) {
        if (!dir.mkpath(sub)) {
            if (error) *error = QString::fromUtf8("Не удалось создать папку: ") + sub;
            return false;
        }
    }

    m_root = emptyProject();
    m_fileName = dir.filePath("project.json");
    setDirty(true);
    if (!save(error))
        return false;
    emit scenesChanged();
    emit documentChanged();
    return true;
}

bool ProjectDocument::load(const QString& fileName, QString* error) {
    QFile file(fileName);
    if (!file.open(QIODevice::ReadOnly)) {
        if (error) *error = file.errorString();
        return false;
    }

    QJsonParseError parseError;
    const QJsonDocument doc = QJsonDocument::fromJson(file.readAll(), &parseError);
    if (parseError.error != QJsonParseError::NoError || !doc.isObject()) {
        if (error) *error = QString::fromUtf8("Ошибка JSON: ") + parseError.errorString();
        return false;
    }

    m_root = doc.object();
    if (!m_root.contains("scenes") || !m_root.value("scenes").isArray()) {
        if (error) *error = QString::fromUtf8("В проекте отсутствует массив scenes");
        return false;
    }

    // Preserve the old web schema as-is and only add native metadata if missing.
    if (!m_root.contains("nativeEditor"))
        m_root.insert("nativeEditor", QJsonObject{{"format", "3dpl-native"}, {"version", 1}});

    m_fileName = QFileInfo(fileName).absoluteFilePath();
    setDirty(false);
    emit scenesChanged();
    emit documentChanged();
    return true;
}

bool ProjectDocument::writeTo(const QString& fileName, QString* error) const {
    QSaveFile file(fileName);
    if (!file.open(QIODevice::WriteOnly)) {
        if (error) *error = file.errorString();
        return false;
    }
    const QByteArray bytes = QJsonDocument(m_root).toJson(QJsonDocument::Indented);
    if (file.write(bytes) != bytes.size()) {
        if (error) *error = file.errorString();
        return false;
    }
    if (!file.commit()) {
        if (error) *error = file.errorString();
        return false;
    }
    return true;
}

bool ProjectDocument::save(QString* error) {
    if (m_fileName.isEmpty()) {
        if (error) *error = QString::fromUtf8("Проект ещё не имеет имени");
        return false;
    }
    if (!writeTo(m_fileName, error))
        return false;
    setDirty(false);
    return true;
}

bool ProjectDocument::saveAs(const QString& fileName, QString* error) {
    if (!writeTo(fileName, error))
        return false;
    m_fileName = QFileInfo(fileName).absoluteFilePath();
    setDirty(false);
    emit documentChanged();
    return true;
}

bool ProjectDocument::autosave(QString* error) const {
    if (m_fileName.isEmpty())
        return false;
    return writeTo(m_fileName + ".autosave", error);
}

QString ProjectDocument::baseDir() const {
    return m_fileName.isEmpty() ? QString() : QFileInfo(m_fileName).absolutePath();
}

QString ProjectDocument::title() const {
    return m_root.value("title").toString(QString::fromUtf8("Виртуальная экскурсия"));
}

void ProjectDocument::setTitle(const QString& title) {
    if (m_root.value("title").toString() == title)
        return;
    m_root.insert("title", title);
    setDirty(true);
    emit documentChanged();
}

QJsonArray ProjectDocument::scenesArray() const {
    return m_root.value("scenes").toArray();
}

void ProjectDocument::setScenesArray(const QJsonArray& scenes) {
    m_root.insert("scenes", scenes);
    setDirty(true);
    emit scenesChanged();
    emit documentChanged();
}

int ProjectDocument::sceneCount() const {
    return scenesArray().size();
}

QJsonObject ProjectDocument::sceneAt(int index) const {
    const QJsonArray scenes = scenesArray();
    return index >= 0 && index < scenes.size() ? scenes.at(index).toObject() : QJsonObject{};
}

int ProjectDocument::sceneIndexById(const QString& id) const {
    const QJsonArray scenes = scenesArray();
    for (int i = 0; i < scenes.size(); ++i) {
        if (scenes.at(i).toObject().value("id").toString() == id)
            return i;
    }
    return -1;
}

QJsonObject ProjectDocument::sceneById(const QString& id) const {
    return sceneAt(sceneIndexById(id));
}

bool ProjectDocument::updateScene(int index, const QJsonObject& scene) {
    QJsonArray scenes = scenesArray();
    if (index < 0 || index >= scenes.size())
        return false;
    scenes.replace(index, scene);
    setScenesArray(scenes);
    return true;
}

bool ProjectDocument::removeScene(int index) {
    QJsonArray scenes = scenesArray();
    if (index < 0 || index >= scenes.size())
        return false;

    const QString removedId = scenes.at(index).toObject().value("id").toString();
    scenes.removeAt(index);
    m_root.insert("scenes", scenes);

    if (m_root.value("firstScene").toString() == removedId)
        m_root.insert("firstScene", scenes.isEmpty() ? QJsonValue::Null : scenes.first().toObject().value("id"));

    // Keep hotspot structure intact, but clear transitions to a removed scene.
    for (int s = 0; s < scenes.size(); ++s) {
        QJsonObject scene = scenes.at(s).toObject();
        QJsonArray hotspots = scene.value("hotspots").toArray();
        bool changed = false;
        for (int h = 0; h < hotspots.size(); ++h) {
            QJsonObject hs = hotspots.at(h).toObject();
            if (hs.value("targetSceneId").toString() == removedId) {
                hs.insert("targetSceneId", "");
                hotspots.replace(h, hs);
                changed = true;
            }
        }
        if (changed) {
            scene.insert("hotspots", hotspots);
            scenes.replace(s, scene);
        }
    }
    m_root.insert("scenes", scenes);

    setDirty(true);
    emit scenesChanged();
    emit documentChanged();
    return true;
}

QString ProjectDocument::importAsset(const QString& sourceFile, const QString& category, QString* error) {
    if (baseDir().isEmpty()) {
        if (error) *error = QString::fromUtf8("Сначала создайте или откройте проект");
        return {};
    }
    QFileInfo sourceInfo(sourceFile);
    if (!sourceInfo.isFile()) {
        if (error) *error = QString::fromUtf8("Файл не найден: ") + sourceFile;
        return {};
    }

    QDir base(baseDir());
    const QString relativeDir = "assets/" + category;
    if (!base.mkpath(relativeDir)) {
        if (error) *error = QString::fromUtf8("Не удалось создать каталог assets");
        return {};
    }

    QString stem = sourceInfo.completeBaseName();
    stem.replace(QRegularExpression("[^A-Za-z0-9_\-]+"), "_");
    if (stem.isEmpty()) stem = "asset";
    const QString ext = sourceInfo.suffix().isEmpty() ? QString() : "." + sourceInfo.suffix().toLower();

    QString name = stem + ext;
    int suffix = 2;
    while (QFileInfo::exists(base.filePath(relativeDir + "/" + name)))
        name = stem + "-" + QString::number(suffix++) + ext;

    const QString relative = relativeDir + "/" + name;
    if (!QFile::copy(sourceInfo.absoluteFilePath(), base.filePath(relative))) {
        if (error) *error = QString::fromUtf8("Не удалось скопировать файл в проект");
        return {};
    }
    return relative;
}

int ProjectDocument::addPanorama(const QString& sourceFile, QString* error) {
    const QString relative = importAsset(sourceFile, "panoramas", error);
    if (relative.isEmpty())
        return -1;

    QJsonArray scenes = scenesArray();
    const QString id = makeId("scene");
    QJsonObject scene{
        {"id", id},
        {"title", QFileInfo(sourceFile).completeBaseName()},
        {"sceneType", "panorama"},
        {"filename", QFileInfo(relative).fileName()},
        {"source", relative},
        {"imageData", relative},
        {"thumbnailData", ""},
        {"viewerImageData", ""},
        {"pitch", 0.0},
        {"yaw", 0.0},
        {"hfov", 100.0},
        {"audio", QJsonObject{
            {"music", QJsonObject{{"data", ""}, {"filename", ""}, {"volume", 35}, {"loop", true}}},
            {"narration", QJsonObject{{"data", ""}, {"filename", ""}, {"volume", 80}, {"loop", false}}}
        }},
        {"textObjects", QJsonArray{}},
        {"mediaObjects", QJsonArray{}},
        {"hotspots", QJsonArray{}}
    };
    scenes.append(scene);
    m_root.insert("scenes", scenes);
    if (m_root.value("firstScene").isNull() || m_root.value("firstScene").toString().isEmpty())
        m_root.insert("firstScene", id);

    setDirty(true);
    emit scenesChanged();
    emit documentChanged();
    return scenes.size() - 1;
}

int ProjectDocument::addGenericScene(const QString& type, const QString& title) {
    QJsonArray scenes = scenesArray();
    const QString id = makeId("scene");
    QJsonObject scene{
        {"id", id}, {"title", title}, {"sceneType", type},
        {"filename", ""}, {"imageData", ""}, {"pitch", 0.0}, {"yaw", 0.0},
        {"hfov", 100.0}, {"textObjects", QJsonArray{}}, {"mediaObjects", QJsonArray{}},
        {"hotspots", QJsonArray{}}
    };
    if (type == "object360")
        scene.insert("object360", QJsonObject{{"sectors", 36}, {"rows", 1}, {"frames", QJsonArray{}}, {"startSector", 0}, {"startRow", 0}});
    else if (type == "stl")
        scene.insert("stl", QJsonObject{{"data", ""}, {"filename", ""}, {"yaw", 0}, {"pitch", -15}, {"zoom", 1.0}, {"color", "#7c8cff"}, {"wireframe", false}});
    else if (type == "xr")
        scene.insert("xr", QJsonObject{{"data", ""}, {"filename", ""}, {"kind", "image"}, {"projection", "360"}, {"yaw", 0}, {"pitch", 0}, {"fov", 80}});

    scenes.append(scene);
    m_root.insert("scenes", scenes);
    if (m_root.value("firstScene").isNull() || m_root.value("firstScene").toString().isEmpty())
        m_root.insert("firstScene", id);
    setDirty(true);
    emit scenesChanged();
    emit documentChanged();
    return scenes.size() - 1;
}

bool ProjectDocument::addHotspot(int sceneIndex, double yaw, double pitch, const QString& type) {
    QJsonObject scene = sceneAt(sceneIndex);
    if (scene.isEmpty()) return false;
    QJsonArray hotspots = scene.value("hotspots").toArray();
    const QString sceneTypeValue = sceneType(scene);
    QString anchorMode = "panorama";
    if (sceneTypeValue == "object360") anchorMode = "object360";
    else if (sceneTypeValue == "stl") anchorMode = "stl-screen";
    else if (sceneTypeValue == "xr") anchorMode = "xr-screen";

    hotspots.append(QJsonObject{
        {"id", makeId("hotspot")},
        {"type", type},
        {"text", QString::fromUtf8("Новая точка")},
        {"pitch", pitch}, {"yaw", yaw},
        {"targetSceneId", ""},
        {"iconPreset", "arrow"},
        {"url", ""}, {"info", ""},
        {"transition", "fade"},
        {"anchorMode", anchorMode},
        {"anchorX", 50.0}, {"anchorY", 50.0},
        {"anchorSector", 0}, {"anchorRow", 0},
        {"anchorYaw", yaw}, {"anchorPitch", pitch},
        {"visible", true}, {"locked", false}, {"zIndex", 30}
    });
    scene.insert("hotspots", hotspots);
    return updateScene(sceneIndex, scene);
}

bool ProjectDocument::removeHotspot(int sceneIndex, int hotspotIndex) {
    QJsonObject scene = sceneAt(sceneIndex);
    QJsonArray hotspots = scene.value("hotspots").toArray();
    if (hotspotIndex < 0 || hotspotIndex >= hotspots.size())
        return false;
    hotspots.removeAt(hotspotIndex);
    scene.insert("hotspots", hotspots);
    return updateScene(sceneIndex, scene);
}

QString ProjectDocument::resolveAsset(const QString& value) const {
    if (value.isEmpty() || value.startsWith("data:", Qt::CaseInsensitive) ||
        value.startsWith("assetref:", Qt::CaseInsensitive))
        return value;

    QFileInfo info(value);
    if (info.isAbsolute() && info.exists())
        return info.absoluteFilePath();

    const QString local = QDir(baseDir()).filePath(value);
    return QFileInfo::exists(local) ? QFileInfo(local).absoluteFilePath() : value;
}

QImage ProjectDocument::loadImageValue(const QString& value) const {
    if (value.startsWith("data:", Qt::CaseInsensitive)) {
        const int comma = value.indexOf(',');
        if (comma > 0) {
            const QString header = value.left(comma);
            const QByteArray payload = value.mid(comma + 1).toLatin1();
            const QByteArray bytes = header.contains(";base64", Qt::CaseInsensitive)
                ? QByteArray::fromBase64(payload)
                : QByteArray::fromPercentEncoding(payload);
            QImage image;
            image.loadFromData(bytes);
            return image;
        }
    }
    if (value.startsWith("assetref:", Qt::CaseInsensitive))
        return {}; // Browser IndexedDB references cannot be resolved outside the browser.
    return QImage(resolveAsset(value));
}

QString ProjectDocument::sceneImageValue(const QJsonObject& scene) const {
    if (!scene.value("source").toString().isEmpty())
        return scene.value("source").toString();
    if (!scene.value("viewerImageData").toString().isEmpty())
        return scene.value("viewerImageData").toString();
    if (!scene.value("imageData").toString().isEmpty())
        return scene.value("imageData").toString();
    if (sceneType(scene) == "object360")
        return scene.value("object360").toObject().value("coverData").toString();
    return {};
}

void ProjectDocument::setRootObject(const QJsonObject& root) {
    m_root = root;
    setDirty(true);
    emit scenesChanged();
    emit documentChanged();
}

QString ProjectDocument::sceneType(const QJsonObject& scene) {
    const QString explicitType = scene.value("sceneType").toString();
    if (!explicitType.isEmpty())
        return explicitType;
    if (scene.contains("xr")) return "xr";
    if (scene.contains("stl")) return "stl";
    if (scene.contains("object360")) return "object360";
    return "panorama";
}

void ProjectDocument::setDirty(bool dirty) {
    if (m_dirty == dirty)
        return;
    m_dirty = dirty;
    emit dirtyChanged(dirty);
}
