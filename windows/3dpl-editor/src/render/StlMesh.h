#pragma once

#include <QString>
#include <QVector>

struct StlVertex {
    float px = 0, py = 0, pz = 0;
    float nx = 0, ny = 1, nz = 0;
};

class StlMesh {
public:
    static bool load(const QString& filePath, QVector<StlVertex>& vertices, QString* error = nullptr);
    static void normalize(QVector<StlVertex>& vertices);
};
