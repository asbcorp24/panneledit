#include "Hotspot.h"

#include <QJsonArray>

Hotspot Hotspot::fromJson(const QJsonObject& json) {
    Hotspot h;
    h.id = json.value("id").toString();
    h.type = json.value("type").toString("scene");
    h.text = json.value("text").toString();
    h.targetSceneId = json.value("targetSceneId").toString();
    h.url = json.value("url").toString();
    h.info = json.value("info").toString();
    h.yaw = json.value("yaw").toDouble();
    h.pitch = json.value("pitch").toDouble();
    h.anchorX = json.value("anchorX").toDouble(50.0);
    h.anchorY = json.value("anchorY").toDouble(50.0);
    h.anchorSector = json.value("anchorSector").toInt();
    h.anchorRow = json.value("anchorRow").toInt();
    h.anchorMode = json.value("anchorMode").toString();
    h.anchorYaw = json.value("anchorYaw").toDouble(h.yaw);
    h.anchorPitch = json.value("anchorPitch").toDouble(h.pitch);

    const auto point = json.value("modelPoint").toArray();
    if (point.size() >= 3) {
        h.hasModelPoint = true;
        h.modelPoint = QVector3D(
            float(point.at(0).toDouble()),
            float(point.at(1).toDouble()),
            float(point.at(2).toDouble())
        );
    }
    return h;
}

QJsonObject Hotspot::toJson() const {
    QJsonObject json{
        {"id", id},
        {"type", type},
        {"text", text},
        {"targetSceneId", targetSceneId},
        {"url", url},
        {"info", info},
        {"yaw", yaw},
        {"pitch", pitch},
        {"anchorX", anchorX},
        {"anchorY", anchorY},
        {"anchorSector", anchorSector},
        {"anchorRow", anchorRow},
        {"anchorMode", anchorMode},
        {"anchorYaw", anchorYaw},
        {"anchorPitch", anchorPitch}
    };
    if (hasModelPoint) {
        json.insert("modelPoint", QJsonArray{
            modelPoint.x(), modelPoint.y(), modelPoint.z()
        });
    }
    return json;
}
