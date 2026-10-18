#pragma once

#include "model/Project.h"

#include <QString>

class PackageExporter {
public:
    static bool exportOpenXrPackage(
        const QString& projectDirectory,
        const Project& project,
        const QString& outputZip,
        QString* error = nullptr
    );

private:
    static bool copyTree(const QString& source, const QString& destination, QString* error);
};
