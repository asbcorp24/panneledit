#include "MultiresGenerator.h"

#include <QDir>
#include <QFileInfo>
#include <QImage>
#include <QImageReader>
#include <QtMath>

#include <algorithm>
#include <array>
#include <cmath>

namespace {

constexpr double kPi = 3.14159265358979323846;

struct Vec3 {
    double x = 0;
    double y = 0;
    double z = -1;
};

Vec3 faceDirection(char face, double u, double v) {
    const double sx = u * 2.0 - 1.0;
    const double sy = 1.0 - v * 2.0;

    Vec3 d;
    switch (face) {
    case 'f': d = { sx,  sy, -1.0}; break;
    case 'b': d = {-sx,  sy,  1.0}; break;
    case 'u': d = { sx, 1.0,  sy}; break;
    case 'd': d = { sx,-1.0, -sy}; break;
    case 'l': d = {-1.0, sy, -sx}; break;
    case 'r': d = { 1.0, sy,  sx}; break;
    default:  d = { sx,  sy, -1.0}; break;
    }

    const double len = std::sqrt(d.x*d.x + d.y*d.y + d.z*d.z);
    d.x /= len;
    d.y /= len;
    d.z /= len;
    return d;
}

QRgb sampleBilinear(const QImage& image, double u, double v) {
    const int w = image.width();
    const int h = image.height();
    if (w <= 0 || h <= 0) return qRgb(0,0,0);

    u -= std::floor(u);
    v = std::clamp(v, 0.0, 1.0);

    const double px = u * w - 0.5;
    const double py = v * h - 0.5;

    int x0 = int(std::floor(px));
    int y0 = int(std::floor(py));
    const double fx = px - std::floor(px);
    const double fy = py - std::floor(py);

    auto wrapX = [w](int x) {
        x %= w;
        if (x < 0) x += w;
        return x;
    };
    y0 = std::clamp(y0, 0, h - 1);
    const int y1 = std::clamp(y0 + 1, 0, h - 1);
    const int x1 = wrapX(x0 + 1);
    x0 = wrapX(x0);

    const QRgb c00 = image.pixel(x0, y0);
    const QRgb c10 = image.pixel(x1, y0);
    const QRgb c01 = image.pixel(x0, y1);
    const QRgb c11 = image.pixel(x1, y1);

    auto mix = [fx, fy](int a00, int a10, int a01, int a11) {
        const double top = a00 * (1.0 - fx) + a10 * fx;
        const double bottom = a01 * (1.0 - fx) + a11 * fx;
        return int(std::clamp(top * (1.0 - fy) + bottom * fy, 0.0, 255.0) + 0.5);
    };

    return qRgb(
        mix(qRed(c00), qRed(c10), qRed(c01), qRed(c11)),
        mix(qGreen(c00), qGreen(c10), qGreen(c01), qGreen(c11)),
        mix(qBlue(c00), qBlue(c10), qBlue(c01), qBlue(c11))
    );
}

QImage makeFace(const QImage& pano, char face, int size) {
    QImage out(size, size, QImage::Format_RGB888);

    for (int y = 0; y < size; ++y) {
        uchar* scan = out.scanLine(y);
        const double v = (y + 0.5) / double(size);

        for (int x = 0; x < size; ++x) {
            const double u = (x + 0.5) / double(size);
            const Vec3 d = faceDirection(face, u, v);

            const double yaw = std::atan2(d.x, -d.z);
            const double pitch = std::asin(std::clamp(d.y, -1.0, 1.0));

            const double panoU = (yaw + kPi) / (2.0 * kPi);
            const double panoV = 0.5 - pitch / kPi;

            const QRgb c = sampleBilinear(pano, panoU, panoV);
            scan[x*3 + 0] = uchar(qRed(c));
            scan[x*3 + 1] = uchar(qGreen(c));
            scan[x*3 + 2] = uchar(qBlue(c));
        }
    }
    return out;
}

int maxLevelFor(int cubeSize, int tileSize) {
    int level = 1;
    int size = tileSize;
    while (size < cubeSize) {
        size *= 2;
        ++level;
    }
    return level;
}

int levelSize(int level, int maxLevel, int cubeSize) {
    int divisor = 1;
    for (int i = level; i < maxLevel; ++i) divisor *= 2;
    return std::max(1, cubeSize / divisor);
}

bool saveJpeg(const QImage& image, const QString& path, int quality) {
    QDir().mkpath(QFileInfo(path).absolutePath());
    return image.save(path, "JPG", quality);
}

} // namespace

bool MultiresGenerator::generate(
    const QString& sourcePanorama,
    const QString& projectDirectory,
    const QString& sceneId,
    const Options& inputOptions,
    MultiresResult& result,
    QString* error,
    const std::function<void(int, const QString&)>& progress
) {
    Options options = inputOptions;
    options.tileSize = std::clamp(options.tileSize, 128, 2048);
    options.jpegQuality = std::clamp(options.jpegQuality, 45, 100);
    options.maxCubeSize = std::clamp(options.maxCubeSize, options.tileSize, 8192);

    QImageReader reader(sourcePanorama);
    reader.setAutoTransform(true);
    QImage pano = reader.read().convertToFormat(QImage::Format_RGB888);
    if (pano.isNull()) {
        if (error) *error = "Не удалось прочитать исходную панораму";
        return false;
    }
    if (pano.width() < 1024 || pano.height() < 512) {
        if (error) *error = "Панорама слишком маленькая для multires";
        return false;
    }

    const int naturalCube = std::max(options.tileSize, pano.width() / 4);
    int cubeSize = std::min(options.maxCubeSize, naturalCube);

    // Keep a power-of-two multiple of tile size so every pyramid level is stable.
    int snapped = options.tileSize;
    while (snapped * 2 <= cubeSize) snapped *= 2;
    cubeSize = snapped;

    const int maxLevel = maxLevelFor(cubeSize, options.tileSize);
    const QString relativeBase = "multires/" + sceneId;
    const QString base = QDir(projectDirectory).filePath(relativeBase);

    QDir(base).removeRecursively();
    QDir().mkpath(base);
    QDir().mkpath(QDir(base).filePath("fallback"));

    const std::array<char,6> faces{'f','b','u','d','l','r'};

    int faceIndex = 0;
    for (const char face : faces) {
        if (progress) {
            progress(
                faceIndex * 100 / int(faces.size()),
                QString("Грань %1/6").arg(faceIndex + 1)
            );
        }

        QImage full = makeFace(pano, face, cubeSize);
        if (full.isNull()) {
            if (error) *error = "Ошибка построения cubemap";
            return false;
        }

        const QImage fallback = full.scaled(
            options.tileSize,
            options.tileSize,
            Qt::IgnoreAspectRatio,
            Qt::SmoothTransformation
        );
        if (!saveJpeg(
                fallback,
                QDir(base).filePath(QString("fallback/%1.jpg").arg(QChar(face))),
                options.jpegQuality
            )) {
            if (error) *error = "Не удалось записать fallback cubemap";
            return false;
        }

        for (int level = 1; level <= maxLevel; ++level) {
            const int size = levelSize(level, maxLevel, cubeSize);
            QImage levelImage = size == cubeSize
                ? full
                : full.scaled(size, size, Qt::IgnoreAspectRatio, Qt::SmoothTransformation);

            const QString levelDir = QDir(base).filePath(QString::number(level));
            QDir().mkpath(levelDir);

            const int tiles = (size + options.tileSize - 1) / options.tileSize;
            for (int ty = 0; ty < tiles; ++ty) {
                for (int tx = 0; tx < tiles; ++tx) {
                    const QRect rect(
                        tx * options.tileSize,
                        ty * options.tileSize,
                        std::min(options.tileSize, size - tx * options.tileSize),
                        std::min(options.tileSize, size - ty * options.tileSize)
                    );
                    const QImage tile = levelImage.copy(rect);
                    const QString name = QString("%1%2_%3.jpg")
                        .arg(QChar(face))
                        .arg(ty)
                        .arg(tx);
                    if (!saveJpeg(
                            tile,
                            QDir(levelDir).filePath(name),
                            options.jpegQuality
                        )) {
                        if (error) *error = "Не удалось записать multires tile " + name;
                        return false;
                    }
                }
            }
        }

        ++faceIndex;
    }

    result.basePath = relativeBase;
    result.tileResolution = options.tileSize;
    result.maxLevel = maxLevel;
    result.cubeResolution = cubeSize;

    if (progress) progress(100, "Готово");
    return true;
}
