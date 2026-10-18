#include "Project.h"

#include <QJsonArray>

Project Project::fromJson(const QJsonObject& json) {
    Project p;
    p.title = json.value("title").toString("Виртуальная экскурсия");
    p.firstSceneId = json.value("firstSceneId").toString(json.value("firstScene").toString());

    const auto audio = json.value("audio").toObject();
    const auto projectMusic = audio.value("music").toObject();
    p.musicSource = projectMusic.value("src").toString();
    p.musicVolume = projectMusic.value("volume").toInt(35);
    p.musicLoop = projectMusic.value("loop").toBool(true);

    p.fadeEnabled = json.value("sceneFadeEnabled").toBool(true);
    p.fadeDurationMs = json.value("sceneFadeDuration").toInt(900);
    p.defaultTransition = json.value("defaultTransition").toString("fade");
    p.autoRotateEnabled = json.value("autoRotateEnabled").toBool(false);
    p.autoRotate = json.value("autoRotate").toDouble(-2.0);

    const auto scenes = json.value("scenes").toArray();
    for (const auto& value : scenes) p.scenes.push_back(Scene::fromJson(value.toObject()));

    if (p.firstSceneId.isEmpty() && !p.scenes.isEmpty()) p.firstSceneId = p.scenes.first().id;
    return p;
}

QJsonObject Project::toJson() const {
    QJsonArray sceneArray;
    for (const auto& scene : scenes) sceneArray.append(scene.toJson());

    QJsonObject audio;
    if (!musicSource.isEmpty()) {
        audio.insert("music", QJsonObject{
            {"src", musicSource},
            {"volume", musicVolume},
            {"loop", musicLoop}
        });
    }

    return QJsonObject{
        {"format", "3dpl-project"},
        {"version", 1},
        {"title", title},
        {"firstSceneId", firstSceneId},
        {"sceneFadeEnabled", fadeEnabled},
        {"sceneFadeDuration", fadeDurationMs},
        {"defaultTransition", defaultTransition},
        {"autoRotateEnabled", autoRotateEnabled},
        {"autoRotate", autoRotate},
        {"audio", audio},
        {"scenes", sceneArray}
    };
}

Scene* Project::findScene(const QString& id) {
    for (auto& scene : scenes) if (scene.id == id) return &scene;
    return nullptr;
}

const Scene* Project::findScene(const QString& id) const {
    for (const auto& scene : scenes) if (scene.id == id) return &scene;
    return nullptr;
}
