#include "StlMesh.h"

#include <QFile>
#include <QTextStream>
#include <QRegularExpression>
#include <QtEndian>

#include <algorithm>
#include <cstring>
#include <cmath>
#include <limits>

namespace {

struct Vec3 {
    float x = 0, y = 0, z = 0;
};

Vec3 sub(const Vec3& a, const Vec3& b) {
    return {a.x - b.x, a.y - b.y, a.z - b.z};
}

Vec3 cross(const Vec3& a, const Vec3& b) {
    return {
        a.y * b.z - a.z * b.y,
        a.z * b.x - a.x * b.z,
        a.x * b.y - a.y * b.x
    };
}

Vec3 normalized(Vec3 v) {
    const float len = std::sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len < 1e-8f) return {0, 1, 0};
    v.x /= len;
    v.y /= len;
    v.z /= len;
    return v;
}

float readFloatLE(const char* p) {
    quint32 bits = qFromLittleEndian<quint32>(reinterpret_cast<const uchar*>(p));
    float value = 0;
    static_assert(sizeof(value) == sizeof(bits));
    std::memcpy(&value, &bits, sizeof(value));
    return value;
}

bool loadBinary(const QByteArray& data, QVector<StlVertex>& vertices) {
    if (data.size() < 84) return false;
    const quint32 count = qFromLittleEndian<quint32>(
        reinterpret_cast<const uchar*>(data.constData() + 80)
    );

    const quint64 required = 84ull + quint64(count) * 50ull;
    if (count == 0 || required > quint64(data.size()) || count > 10'000'000u) return false;

    vertices.clear();
    vertices.reserve(int(std::min<quint64>(quint64(count) * 3ull, quint64(std::numeric_limits<int>::max()))));

    const char* p = data.constData() + 84;
    for (quint32 i = 0; i < count; ++i, p += 50) {
        Vec3 n{
            readFloatLE(p + 0),
            readFloatLE(p + 4),
            readFloatLE(p + 8)
        };
        Vec3 a{
            readFloatLE(p + 12),
            readFloatLE(p + 16),
            readFloatLE(p + 20)
        };
        Vec3 b{
            readFloatLE(p + 24),
            readFloatLE(p + 28),
            readFloatLE(p + 32)
        };
        Vec3 c{
            readFloatLE(p + 36),
            readFloatLE(p + 40),
            readFloatLE(p + 44)
        };

        n = normalized(n);
        if (std::abs(n.x) + std::abs(n.y) + std::abs(n.z) < 0.01f)
            n = normalized(cross(sub(b, a), sub(c, a)));

        vertices.push_back({a.x, a.y, a.z, n.x, n.y, n.z});
        vertices.push_back({b.x, b.y, b.z, n.x, n.y, n.z});
        vertices.push_back({c.x, c.y, c.z, n.x, n.y, n.z});
    }
    return !vertices.isEmpty();
}

bool loadAscii(const QByteArray& data, QVector<StlVertex>& vertices) {
    const QString text = QString::fromUtf8(data);
    const QStringList tokens = text.split(QRegularExpression("\\s+"), Qt::SkipEmptyParts);
    if (tokens.size() < 10) return false;

    vertices.clear();
    Vec3 normal{0, 1, 0};

    for (qsizetype i = 0; i < tokens.size();) {
        const QString token = tokens.at(i++);
        if (token == "facet" && i < tokens.size() && tokens.at(i) == "normal") {
            ++i;
            if (i + 2 >= tokens.size()) break;
            normal = normalized({
                tokens.at(i++).toFloat(),
                tokens.at(i++).toFloat(),
                tokens.at(i++).toFloat()
            });
        } else if (token == "vertex") {
            if (i + 2 >= tokens.size()) break;
            vertices.push_back({
                tokens.at(i++).toFloat(),
                tokens.at(i++).toFloat(),
                tokens.at(i++).toFloat(),
                normal.x, normal.y, normal.z
            });
            if (vertices.size() > 30'000'000) return false;
        }
    }

    return vertices.size() >= 3;
}

} // namespace

bool StlMesh::load(const QString& filePath, QVector<StlVertex>& vertices, QString* error) {
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly)) {
        if (error) *error = "Не удалось открыть STL";
        return false;
    }

    const QByteArray data = file.readAll();
    if (data.size() > 2'000'000'000) {
        if (error) *error = "STL слишком большой";
        return false;
    }

    if (!loadBinary(data, vertices) && !loadAscii(data, vertices)) {
        if (error) *error = "Не удалось распознать binary/ASCII STL";
        return false;
    }

    normalize(vertices);
    return true;
}

void StlMesh::normalize(QVector<StlVertex>& vertices) {
    if (vertices.isEmpty()) return;

    float minX = std::numeric_limits<float>::max();
    float minY = minX;
    float minZ = minX;
    float maxX = -minX;
    float maxY = -minX;
    float maxZ = -minX;

    for (const auto& v : vertices) {
        minX = std::min(minX, v.px);
        minY = std::min(minY, v.py);
        minZ = std::min(minZ, v.pz);
        maxX = std::max(maxX, v.px);
        maxY = std::max(maxY, v.py);
        maxZ = std::max(maxZ, v.pz);
    }

    const float cx = (minX + maxX) * 0.5f;
    const float cy = (minY + maxY) * 0.5f;
    const float cz = (minZ + maxZ) * 0.5f;
    const float span = std::max({maxX - minX, maxY - minY, maxZ - minZ, 1e-6f});
    const float scale = 1.7f / span;

    for (auto& v : vertices) {
        v.px = (v.px - cx) * scale;
        v.py = (v.py - cy) * scale;
        v.pz = (v.pz - cz) * scale;
    }
}
