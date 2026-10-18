#pragma once

#include "Scene.h"

#include <QJsonObject>
#include <QString>
#include <QVector>

class Project {
public:
    QString title = "Виртуальная экскурсия";
    QString firstSceneId;

    QString musicSource;
    int musicVolume = 35;
    bool musicLoop = true;

    bool fadeEnabled = true;
    int fadeDurationMs = 900;
    QString defaultTransition = "fade";

    bool autoRotateEnabled = false;
    double autoRotate = -2.0;

    QVector<Scene> scenes;

    static Project fromJson(const QJsonObject& json);
    QJsonObject toJson() const;

    Scene* findScene(const QString& id);
    const Scene* findScene(const QString& id) const;
};
