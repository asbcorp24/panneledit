#pragma once

#include <QJsonObject>
#include <QString>
#include <QVector3D>

struct Hotspot {
    QString id;
    QString type = "scene";
    QString text;
    QString targetSceneId;
    QString url;
    QString info;

    double yaw = 0.0;
    double pitch = 0.0;

    double anchorX = 50.0;
    double anchorY = 50.0;
    int anchorSector = 0;
    int anchorRow = 0;

    QString anchorMode;
    double anchorYaw = 0.0;
    double anchorPitch = 0.0;

    bool hasModelPoint = false;
    QVector3D modelPoint;

    QJsonObject extra;

    static Hotspot fromJson(const QJsonObject& json);
    QJsonObject toJson() const;
};
