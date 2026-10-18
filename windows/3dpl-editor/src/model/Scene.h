#pragma once

#include "Hotspot.h"

#include <QJsonObject>
#include <QString>
#include <QVector>

enum class SceneType {
    Panorama,
    Object360,
    Stl,
    Xr
};

struct Scene {
    QString id;
    QString title;
    SceneType type = SceneType::Panorama;

    QString source;
    QString filename;

    double yaw = 0.0;
    double pitch = 0.0;
    double fov = 100.0;

    QString projection = "360";
    QString xrKind = "image";
    bool autoplay = false;
    bool loop = false;
    int volume = 80;

    int sectors = 0;
    int rows = 0;
    int startSector = 0;
    int startRow = 0;
    QVector<QVector<QString>> frames;

    double zoom = 1.0;
    bool wireframe = false;
    QString color = "#7c8cff";

    QString musicSource;
    int musicVolume = 60;
    bool musicLoop = true;
    QString narrationSource;
    int narrationVolume = 80;

    QString multiresBasePath;
    int multiresTileResolution = 512;
    int multiresMaxLevel = 1;
    int multiresCubeResolution = 0;

    QVector<Hotspot> hotspots;

    static Scene fromJson(const QJsonObject& json);
    QJsonObject toJson() const;

    static QString typeToString(SceneType type);
    static SceneType typeFromString(const QString& value);
};
