#pragma once

#include "model/Project.h"

#include <QString>

class ProjectStorage {
public:
    static bool createProject(const QString& directory, Project& project, QString* error = nullptr);
    static bool loadProject(const QString& directory, Project& project, QString* error = nullptr);
    static bool saveProject(const QString& directory, const Project& project, QString* error = nullptr);

    static QString importAsset(
        const QString& projectDirectory,
        const QString& sourceFile,
        const QString& category,
        QString* error = nullptr
    );

    static QString resolveAsset(const QString& projectDirectory, const QString& relativePath);
    static bool ensureLayout(const QString& directory, QString* error = nullptr);
};
