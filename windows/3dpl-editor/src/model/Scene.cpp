#include "Scene.h"

#include <QJsonArray>

QString Scene::typeToString(SceneType type) {
    switch (type) {
    case SceneType::Object360: return "object360";
    case SceneType::Stl: return "stl";
    case SceneType::Xr: return "xr";
    case SceneType::Panorama:
    default: return "panorama";
    }
}

SceneType Scene::typeFromString(const QString& value) {
    if (value == "object360") return SceneType::Object360;
    if (value == "stl") return SceneType::Stl;
    if (value == "xr") return SceneType::Xr;
    return SceneType::Panorama;
}

Scene Scene::fromJson(const QJsonObject& json) {
    Scene s;
    s.id = json.value("id").toString();
    s.title = json.value("title").toString(s.id);
    s.type = typeFromString(json.value("sceneType").toString(json.value("type").toString("panorama")));
    s.source = json.value("source").toString(json.value("data").toString());
    s.filename = json.value("filename").toString();
    s.yaw = json.value("yaw").toDouble();
    s.pitch = json.value("pitch").toDouble();
    s.fov = json.value("fov").toDouble(json.value("hfov").toDouble(100.0));

    s.projection = json.value("projection").toString("360");
    s.xrKind = json.value("kind").toString("image");
    s.autoplay = json.value("autoplay").toBool();
    s.loop = json.value("loop").toBool();
    s.volume = json.value("volume").toInt(80);

    s.sectors = json.value("sectors").toInt();
    s.rows = json.value("rows").toInt();
    s.startSector = json.value("startSector").toInt();
    s.startRow = json.value("startRow").toInt();

    const auto frameRows = json.value("frames").toArray();
    for (const auto& rowValue : frameRows) {
        QVector<QString> row;
        for (const auto& frameValue : rowValue.toArray()) row.push_back(frameValue.toString());
        s.frames.push_back(row);
    }

    s.zoom = json.value("zoom").toDouble(1.0);
    s.wireframe = json.value("wireframe").toBool();
    s.color = json.value("color").toString("#7c8cff");

    const auto audio = json.value("audio").toObject();
    const auto music = audio.value("music").toObject();
    const auto narration = audio.value("narration").toObject();
    s.musicSource = music.value("src").toString();
    s.musicVolume = music.value("volume").toInt(60);
    s.musicLoop = music.value("loop").toBool(true);
    s.narrationSource = narration.value("src").toString();
    s.narrationVolume = narration.value("volume").toInt(80);

    const auto multires = json.value("multires").toObject();
    s.multiresBasePath = multires.value("basePath").toString();
    s.multiresTileResolution = multires.value("tileResolution").toInt(512);
    s.multiresMaxLevel = multires.value("maxLevel").toInt(1);
    s.multiresCubeResolution = multires.value("cubeResolution").toInt(0);

    const auto hotspots = json.value("hotspots").toArray();
    for (const auto& value : hotspots) s.hotspots.push_back(Hotspot::fromJson(value.toObject()));
    return s;
}

QJsonObject Scene::toJson() const {
    QJsonArray hotspotArray;
    for (const auto& hotspot : hotspots) hotspotArray.append(hotspot.toJson());

    QJsonArray frameRows;
    for (const auto& row : frames) {
        QJsonArray rowJson;
        for (const auto& frame : row) rowJson.append(frame);
        frameRows.append(rowJson);
    }

    QJsonObject json{
        {"id", id},
        {"title", title},
        {"sceneType", typeToString(type)},
        {"source", source},
        {"filename", filename},
        {"yaw", yaw},
        {"pitch", pitch},
        {"fov", fov},
        {"projection", projection},
        {"kind", xrKind},
        {"autoplay", autoplay},
        {"loop", loop},
        {"volume", volume},
        {"sectors", sectors},
        {"rows", rows},
        {"startSector", startSector},
        {"startRow", startRow},
        {"frames", frameRows},
        {"zoom", zoom},
        {"wireframe", wireframe},
        {"color", color},
        {"hotspots", hotspotArray}
    };

    QJsonObject audio;
    if (!musicSource.isEmpty()) {
        audio.insert("music", QJsonObject{
            {"src", musicSource},
            {"volume", musicVolume},
            {"loop", musicLoop}
        });
    }
    if (!narrationSource.isEmpty()) {
        audio.insert("narration", QJsonObject{
            {"src", narrationSource},
            {"volume", narrationVolume}
        });
    }
    json.insert("audio", audio);

    if (!multiresBasePath.isEmpty()) {
        json.insert("multires", QJsonObject{
            {"basePath", multiresBasePath},
            {"tileResolution", multiresTileResolution},
            {"maxLevel", multiresMaxLevel},
            {"cubeResolution", multiresCubeResolution}
        });
    }

    return json;
}
