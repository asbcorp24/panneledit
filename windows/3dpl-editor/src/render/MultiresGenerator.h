#pragma once

#include <QString>
#include <functional>

struct MultiresResult {
    QString basePath;
    int tileResolution = 512;
    int maxLevel = 1;
    int cubeResolution = 512;
};

class MultiresGenerator {
public:
    struct Options {
        int tileSize = 512;
        int jpegQuality = 82;
        int maxCubeSize = 4096;
    };

    static bool generate(
        const QString& sourcePanorama,
        const QString& projectDirectory,
        const QString& sceneId,
        const Options& options,
        MultiresResult& result,
        QString* error = nullptr,
        const std::function<void(int, const QString&)>& progress = {}
    );
};
