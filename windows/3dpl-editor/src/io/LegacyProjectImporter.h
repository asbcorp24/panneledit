#pragma once

#include "model/Project.h"

#include <QJsonValue>
#include <QString>

class LegacyProjectImporter {
public:
    static bool importJson(
        const QString& jsonFile,
        const QString& targetProjectDirectory,
        Project& project,
        QString* error = nullptr
    );

    static QString materializeDataUrl(
        const QString& value,
        const QString& targetProjectDirectory,
        const QString& category,
        const QString& preferredName,
        QString* error
    );

private:
    static QJsonValue materializeRecursive(
        const QJsonValue& value,
        const QString& targetProjectDirectory,
        const QString& category,
        QString* error
    );
};
