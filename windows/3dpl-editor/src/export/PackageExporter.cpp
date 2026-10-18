#include "PackageExporter.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QProcess>
#include <QSaveFile>
#include <QTemporaryDir>

namespace {

QJsonObject audioSlot(const QString& src, int volume, bool loop = false) {
    if (src.isEmpty()) return {};
    QJsonObject object{
        {"src", src},
        {"volume", volume}
    };
    if (loop) object.insert("loop", true);
    return object;
}

QJsonObject hotspotJson(const Hotspot& h) {
    QJsonObject json = h.toJson();
    return json;
}

QJsonObject sceneJson(const Scene& scene) {
    QJsonObject out{
        {"id", scene.id},
        {"title", scene.title},
        {"type", Scene::typeToString(scene.type)}
    };

    QJsonArray hotspots;
    for (const auto& h : scene.hotspots) hotspots.append(hotspotJson(h));
    out.insert("hotspots", hotspots);

    QJsonObject audio;
    if (!scene.musicSource.isEmpty()) {
        auto music = audioSlot(scene.musicSource, scene.musicVolume, scene.musicLoop);
        audio.insert("music", music);
    }
    if (!scene.narrationSource.isEmpty()) {
        audio.insert("narration", audioSlot(scene.narrationSource, scene.narrationVolume));
    }
    out.insert("audio", audio);

    switch (scene.type) {
    case SceneType::Panorama:
        out.insert("source", scene.source);
        out.insert("projection", "360");
        out.insert("yaw", scene.yaw);
        out.insert("pitch", scene.pitch);
        out.insert("fov", scene.fov);
        break;

    case SceneType::Xr:
        out.insert("source", scene.source);
        out.insert("kind", scene.xrKind);
        out.insert("projection", scene.projection);
        out.insert("yaw", scene.yaw);
        out.insert("pitch", scene.pitch);
        out.insert("fov", scene.fov);
        out.insert("autoplay", scene.autoplay);
        out.insert("loop", scene.loop);
        out.insert("volume", scene.volume);
        break;

    case SceneType::Object360: {
        out.insert("sectors", scene.sectors);
        out.insert("rows", scene.rows);
        out.insert("startSector", scene.startSector);
        out.insert("startRow", scene.startRow);
        out.insert("autoplay", scene.autoplay);

        QJsonArray rows;
        for (const auto& row : scene.frames) {
            QJsonArray jsonRow;
            for (const auto& frame : row) jsonRow.append(frame);
            rows.append(jsonRow);
        }
        out.insert("frames", rows);
        break;
    }

    case SceneType::Stl:
        out.insert("source", scene.source);
        out.insert("yaw", scene.yaw);
        out.insert("pitch", scene.pitch);
        out.insert("zoom", scene.zoom);
        out.insert("color", scene.color);
        out.insert("wireframe", scene.wireframe);
        out.insert("autoplay", scene.autoplay);
        break;
    }

    return out;
}

QJsonObject buildManifest(const Project& project) {
    QJsonArray scenes;
    QJsonArray order;
    for (const auto& scene : project.scenes) {
        scenes.append(sceneJson(scene));
        order.append(scene.id);
    }

    QJsonObject projectAudio;
    if (!project.musicSource.isEmpty()) {
        projectAudio.insert(
            "music",
            audioSlot(project.musicSource, project.musicVolume, project.musicLoop)
        );
    }

    return QJsonObject{
        {"format", "xr-tour-openxr"},
        {"version", 1},
        {"title", project.title},
        {"firstScene", project.firstSceneId},
        {"sceneOrder", order},
        {"projectAudio", projectAudio},
        {"scenes", scenes}
    };
}

bool writeJson(const QString& path, const QJsonObject& object, QString* error) {
    QSaveFile file(path);
    if (!file.open(QIODevice::WriteOnly)) {
        if (error) *error = "Не удалось записать " + QFileInfo(path).fileName();
        return false;
    }
    file.write(QJsonDocument(object).toJson(QJsonDocument::Indented));
    if (!file.commit()) {
        if (error) *error = "Не удалось завершить запись " + QFileInfo(path).fileName();
        return false;
    }
    return true;
}

} // namespace

bool PackageExporter::copyTree(
    const QString& source,
    const QString& destination,
    QString* error
) {
    QDir src(source);
    if (!src.exists()) return true;

    if (!QDir().mkpath(destination)) {
        if (error) *error = "Не удалось создать " + destination;
        return false;
    }

    const auto entries = src.entryInfoList(
        QDir::Files | QDir::Dirs | QDir::NoDotAndDotDot,
        QDir::DirsFirst | QDir::Name
    );

    for (const auto& entry : entries) {
        const QString dst = QDir(destination).filePath(entry.fileName());
        if (entry.isDir()) {
            if (!copyTree(entry.absoluteFilePath(), dst, error)) return false;
        } else {
            QFile::remove(dst);
            if (!QFile::copy(entry.absoluteFilePath(), dst)) {
                if (error) *error = "Не удалось скопировать " + entry.fileName();
                return false;
            }
        }
    }
    return true;
}

bool PackageExporter::exportOpenXrPackage(
    const QString& projectDirectory,
    const Project& project,
    const QString& outputZip,
    QString* error
) {
    if (project.scenes.isEmpty()) {
        if (error) *error = "В проекте нет сцен";
        return false;
    }

    QTemporaryDir staging;
    if (!staging.isValid()) {
        if (error) *error = "Не удалось создать временную папку";
        return false;
    }

    const QString root = staging.path();
    if (!copyTree(
            QDir(projectDirectory).filePath("assets"),
            QDir(root).filePath("assets"),
            error
        )) {
        return false;
    }

    if (!copyTree(
            QDir(projectDirectory).filePath("multires"),
            QDir(root).filePath("multires"),
            error
        )) {
        return false;
    }

    if (!writeJson(
            QDir(root).filePath("openxr-manifest.json"),
            buildManifest(project),
            error
        )) {
        return false;
    }

    const QJsonObject packageManifest{
        {"format", "xr-tour-player"},
        {"version", 1},
        {"title", project.title},
        {"openxrManifest", "openxr-manifest.json"},
        {"nativeOnly", true}
    };
    if (!writeJson(
            QDir(root).filePath("player-manifest.json"),
            packageManifest,
            error
        )) {
        return false;
    }

    QFile::remove(outputZip);
    QDir().mkpath(QFileInfo(outputZip).absolutePath());

    QProcess tar;
    tar.setWorkingDirectory(root);
    tar.start(
        "tar.exe",
        {
            "-a",
            "-cf",
            QDir::toNativeSeparators(outputZip),
            "-C",
            QDir::toNativeSeparators(root),
            "."
        }
    );

    if (!tar.waitForStarted(5000)) {
        if (error) *error = "Не найден tar.exe в Windows";
        return false;
    }
    if (!tar.waitForFinished(10 * 60 * 1000)) {
        tar.kill();
        if (error) *error = "ZIP экспорт превысил лимит времени";
        return false;
    }
    if (tar.exitStatus() != QProcess::NormalExit || tar.exitCode() != 0) {
        if (error) {
            *error = "Ошибка ZIP: " +
                QString::fromLocal8Bit(tar.readAllStandardError()).trimmed();
        }
        return false;
    }

    return QFileInfo::exists(outputZip) && QFileInfo(outputZip).size() > 0;
}
