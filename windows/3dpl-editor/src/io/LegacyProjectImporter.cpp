#include "LegacyProjectImporter.h"

#include "io/ProjectStorage.h"

#include <QByteArray>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QRegularExpression>
#include <QUuid>
#include <QUrl>

#include <algorithm>

namespace {

QString safeStem(QString name, const QString& fallback) {
    name = QFileInfo(name).completeBaseName();
    name.replace(QRegularExpression("[^A-Za-z0-9А-Яа-я_-]+"), "_");
    name = name.left(70);
    return name.isEmpty() ? fallback : name;
}

QString extensionForMime(QString mime) {
    mime = mime.toLower();
    if (mime.contains("jpeg") || mime.contains("jpg")) return "jpg";
    if (mime.contains("png")) return "png";
    if (mime.contains("webp")) return "webp";
    if (mime.contains("gif")) return "gif";
    if (mime.contains("mp4")) return "mp4";
    if (mime.contains("webm")) return "webm";
    if (mime.contains("mpeg")) return "mp3";
    if (mime.contains("ogg")) return "ogg";
    if (mime.contains("wav")) return "wav";
    if (mime.contains("flac")) return "flac";
    if (mime.contains("pdf")) return "pdf";
    if (mime.contains("stl") || mime.contains("sla")) return "stl";
    return "bin";
}

bool decodeDataUrl(const QString& value, QByteArray& bytes, QString& mime) {
    static const QRegularExpression re(
        R"(^data:([^;,]+)?(;base64)?,(.*)$)",
        QRegularExpression::DotMatchesEverythingOption
    );
    const auto match = re.match(value);
    if (!match.hasMatch()) return false;

    mime = match.captured(1);
    const bool base64 = !match.captured(2).isEmpty();
    const QByteArray payload = match.captured(3).toUtf8();
    bytes = base64
        ? QByteArray::fromBase64(payload)
        : QUrl::fromPercentEncoding(payload).toUtf8();
    return !bytes.isEmpty();
}

QString materializeSlot(
    const QJsonObject& slot,
    const QString& projectDir,
    const QString& category,
    const QString& fallback,
    QString* error
) {
    const QString data = slot.value("data").toString();
    if (data.isEmpty()) return {};
    return LegacyProjectImporter::materializeDataUrl(
        data,
        projectDir,
        category,
        slot.value("filename").toString(fallback),
        error
    );
}

QJsonObject legacyAudioToNative(
    const QJsonObject& audio,
    const QString& projectDir,
    QString* error,
    QString* musicSource = nullptr,
    int* musicVolume = nullptr,
    bool* musicLoop = nullptr,
    QString* narrationSource = nullptr,
    int* narrationVolume = nullptr
) {
    QJsonObject out;

    const auto music = audio.value("music").toObject();
    if (!music.isEmpty()) {
        const QString source = materializeSlot(music, projectDir, "audio", "music", error);
        if (!source.isEmpty()) {
            out.insert("music", QJsonObject{
                {"src", source},
                {"volume", music.value("volume").toInt(45)},
                {"loop", music.value("loop").toBool(true)}
            });
            if (musicSource) *musicSource = source;
        }
        if (musicVolume) *musicVolume = music.value("volume").toInt(45);
        if (musicLoop) *musicLoop = music.value("loop").toBool(true);
    }

    const auto narration = audio.value("narration").toObject();
    if (!narration.isEmpty()) {
        const QString source = materializeSlot(
            narration,
            projectDir,
            "audio",
            "narration",
            error
        );
        if (!source.isEmpty()) {
            out.insert("narration", QJsonObject{
                {"src", source},
                {"volume", narration.value("volume").toInt(80)}
            });
            if (narrationSource) *narrationSource = source;
        }
        if (narrationVolume) *narrationVolume = narration.value("volume").toInt(80);
    }

    return out;
}

QString materializeMaybe(
    const QString& value,
    const QString& projectDir,
    const QString& category,
    const QString& preferredName,
    QString* error
) {
    if (value.startsWith("data:", Qt::CaseInsensitive)) {
        return LegacyProjectImporter::materializeDataUrl(
            value, projectDir, category, preferredName, error
        );
    }
    return value;
}

} // namespace

QString LegacyProjectImporter::materializeDataUrl(
    const QString& value,
    const QString& targetProjectDirectory,
    const QString& category,
    const QString& preferredName,
    QString* error
) {
    QByteArray bytes;
    QString mime;
    if (!decodeDataUrl(value, bytes, mime)) {
        if (error) *error = "Некорректный data URL";
        return {};
    }

    QString extension = QFileInfo(preferredName).suffix();
    if (extension.isEmpty()) extension = extensionForMime(mime);

    const QString stem = safeStem(preferredName, "asset");
    const QString filename =
        stem + "_" + QUuid::createUuid().toString(QUuid::Id128).left(8) +
        "." + extension.toLower();

    const QString folder = QDir(targetProjectDirectory).filePath("assets/" + category);
    if (!QDir().mkpath(folder)) {
        if (error) *error = "Не удалось создать assets/" + category;
        return {};
    }

    const QString absolute = QDir(folder).filePath(filename);
    QFile file(absolute);
    if (!file.open(QIODevice::WriteOnly) || file.write(bytes) != bytes.size()) {
        if (error) *error = "Не удалось записать " + filename;
        return {};
    }

    return QDir(targetProjectDirectory)
        .relativeFilePath(absolute)
        .replace('\\', '/');
}

QJsonValue LegacyProjectImporter::materializeRecursive(
    const QJsonValue& value,
    const QString& targetProjectDirectory,
    const QString& category,
    QString* error
) {
    if (value.isString()) {
        const QString s = value.toString();
        if (!s.startsWith("data:", Qt::CaseInsensitive)) return s;

        const QString path = materializeDataUrl(
            s,
            targetProjectDirectory,
            category,
            "legacy_asset",
            error
        );
        return path.isEmpty() ? value : QJsonValue(path);
    }

    if (value.isArray()) {
        QJsonArray out;
        for (const auto& item : value.toArray()) {
            out.append(materializeRecursive(
                item,
                targetProjectDirectory,
                category,
                error
            ));
        }
        return out;
    }

    if (value.isObject()) {
        QJsonObject out;
        const auto source = value.toObject();
        for (auto it = source.begin(); it != source.end(); ++it) {
            out.insert(
                it.key(),
                materializeRecursive(
                    it.value(),
                    targetProjectDirectory,
                    category,
                    error
                )
            );
        }
        return out;
    }

    return value;
}

bool LegacyProjectImporter::importJson(
    const QString& jsonFile,
    const QString& targetProjectDirectory,
    Project& project,
    QString* error
) {
    QFile file(jsonFile);
    if (!file.open(QIODevice::ReadOnly)) {
        if (error) *error = "Не удалось открыть старый JSON-проект";
        return false;
    }

    QJsonParseError parseError;
    const auto document = QJsonDocument::fromJson(file.readAll(), &parseError);
    if (parseError.error != QJsonParseError::NoError || !document.isObject()) {
        if (error) *error = "Ошибка JSON: " + parseError.errorString();
        return false;
    }

    if (!ProjectStorage::ensureLayout(targetProjectDirectory, error)) return false;
    QDir().mkpath(QDir(targetProjectDirectory).filePath("assets/media"));

    const QJsonObject root = document.object();
    Project imported;
    imported.title = root.value("title").toString("Виртуальная экскурсия");
    imported.firstSceneId = root.value("firstScene").toString(
        root.value("firstSceneId").toString()
    );

    const auto projectAudio = root.value("audio").toObject();
    legacyAudioToNative(
        projectAudio,
        targetProjectDirectory,
        error,
        &imported.musicSource,
        &imported.musicVolume,
        &imported.musicLoop
    );

    imported.startScreen = materializeRecursive(
        root.value("startScreen"),
        targetProjectDirectory,
        "media",
        error
    ).toObject();
    imported.guide = root.value("guide").toObject();
    imported.exportSettings = root.value("exportSettings").toObject();
    imported.extraSettings = root.value("settings").toObject();

    imported.fadeEnabled = imported.extraSettings.value("fadeEnabled").toBool(true);
    imported.fadeDurationMs = imported.extraSettings.value("fadeDuration").toInt(900);
    imported.defaultTransition = imported.extraSettings.value("defaultTransition").toString("fade");
    imported.autoRotateEnabled = imported.extraSettings.value("autoRotateEnabled").toBool(false);
    imported.autoRotate = imported.extraSettings.value("autoRotate").toDouble(-2.0);

    const auto scenes = root.value("scenes").toArray();
    for (const auto& sceneValue : scenes) {
        const QJsonObject legacy = sceneValue.toObject();
        Scene scene;
        scene.id = legacy.value("id").toString();
        scene.title = legacy.value("title").toString(scene.id);
        scene.filename = legacy.value("filename").toString();
        scene.yaw = legacy.value("yaw").toDouble();
        scene.pitch = legacy.value("pitch").toDouble();
        scene.fov = legacy.value("hfov").toDouble(100.0);

        const QString sceneType = legacy.value("sceneType").toString("panorama");
        scene.type = Scene::typeFromString(sceneType);

        legacyAudioToNative(
            legacy.value("audio").toObject(),
            targetProjectDirectory,
            error,
            &scene.musicSource,
            &scene.musicVolume,
            &scene.musicLoop,
            &scene.narrationSource,
            &scene.narrationVolume
        );

        scene.textObjects = materializeRecursive(
            legacy.value("textObjects"),
            targetProjectDirectory,
            "media",
            error
        ).toArray();
        scene.mediaObjects = materializeRecursive(
            legacy.value("mediaObjects"),
            targetProjectDirectory,
            "media",
            error
        ).toArray();

        for (const auto& hotspotValue : legacy.value("hotspots").toArray()) {
            QJsonObject h = materializeRecursive(
                hotspotValue,
                targetProjectDirectory,
                "media",
                error
            ).toObject();
            scene.hotspots.push_back(Hotspot::fromJson(h));
        }

        if (scene.type == SceneType::Panorama) {
            scene.source = materializeMaybe(
                legacy.value("imageData").toString(),
                targetProjectDirectory,
                "panoramas",
                scene.filename.isEmpty() ? scene.id + ".jpg" : scene.filename,
                error
            );
        } else if (scene.type == SceneType::Object360) {
            const auto object = legacy.value("object360").toObject();
            scene.sectors = std::max(1, object.value("sectors").toInt(36));
            scene.rows = std::max(1, object.value("rows").toInt(1));
            scene.startSector = object.value("startSector").toInt();
            scene.startRow = object.value("startRow").toInt();
            scene.autoplay = object.value("autoplay").toBool();
            scene.backgroundMode = object.value("backgroundMode").toString("hitech");
            scene.backgroundColor = object.value("backgroundColor").toString("#ffffff");
            scene.backgroundImageSource = materializeMaybe(
                object.value("backgroundImageData").toString(),
                targetProjectDirectory,
                "media",
                object.value("backgroundImageName").toString("object_background.jpg"),
                error
            );

            const auto rows = object.value("frames").toArray();
            for (int r = 0; r < rows.size(); ++r) {
                QVector<QString> row;
                const auto sourceRow = rows.at(r).toArray();
                for (int s = 0; s < sourceRow.size(); ++s) {
                    const QString data = sourceRow.at(s).toString();
                    row.push_back(materializeMaybe(
                        data,
                        targetProjectDirectory,
                        "object360/" + scene.id,
                        QString("frame_%1_%2.jpg").arg(r).arg(s),
                        error
                    ));
                }
                scene.frames.push_back(row);
            }
        } else if (scene.type == SceneType::Stl) {
            const auto stl = legacy.value("stl").toObject();
            scene.source = materializeMaybe(
                stl.value("data").toString(),
                targetProjectDirectory,
                "stl",
                stl.value("filename").toString(scene.id + ".stl"),
                error
            );
            scene.filename = stl.value("filename").toString(scene.filename);
            scene.yaw = stl.value("yaw").toDouble();
            scene.pitch = stl.value("pitch").toDouble(-15.0);
            scene.zoom = stl.value("zoom").toDouble(1.0);
            scene.wireframe = stl.value("wireframe").toBool();
            scene.autoplay = stl.value("autoplay").toBool();
            scene.color = stl.value("color").toString("#7c8cff");
            scene.backgroundMode = stl.value("backgroundMode").toString("hitech");
            scene.backgroundSceneId = stl.value("backgroundSceneId").toString();
            scene.backgroundImageSource = materializeMaybe(
                stl.value("backgroundImageData").toString(),
                targetProjectDirectory,
                "media",
                stl.value("backgroundImageName").toString("stl_background.jpg"),
                error
            );
        } else if (scene.type == SceneType::Xr) {
            const auto xr = legacy.value("xr").toObject();
            scene.source = materializeMaybe(
                xr.value("data").toString(),
                targetProjectDirectory,
                "xr",
                xr.value("filename").toString(scene.id + ".jpg"),
                error
            );
            scene.filename = xr.value("filename").toString(scene.filename);
            scene.xrKind = xr.value("kind").toString("image");
            scene.projection = xr.value("projection").toString("360");
            scene.yaw = xr.value("yaw").toDouble();
            scene.pitch = xr.value("pitch").toDouble();
            scene.fov = xr.value("fov").toDouble(80.0);
            scene.autoplay = xr.value("autoplay").toBool();
            scene.loop = xr.value("loop").toBool();
            scene.volume = xr.value("volume").toInt(80);
        }

        if (scene.id.isEmpty()) {
            scene.id = "scene_" + QUuid::createUuid().toString(QUuid::Id128).left(8);
        }
        imported.scenes.push_back(scene);
    }

    if (imported.firstSceneId.isEmpty() && !imported.scenes.isEmpty()) {
        imported.firstSceneId = imported.scenes.first().id;
    }

    project = std::move(imported);
    return ProjectStorage::saveProject(
        targetProjectDirectory,
        project,
        error
    );
}
