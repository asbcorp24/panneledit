#pragma once
#include <string>
#include <vector>

struct StlVertex {
    float px, py, pz;
    float nx, ny, nz;
};

bool loadStlMesh(const std::string& path, std::vector<StlVertex>& out);
void normalizeStlMesh(std::vector<StlVertex>& vertices);
