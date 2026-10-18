#include "stl_mesh.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <limits>
#include <sstream>

namespace {

struct Vec3 { float x,y,z; };

Vec3 cross(Vec3 a, Vec3 b) {
    return {
        a.y*b.z - a.z*b.y,
        a.z*b.x - a.x*b.z,
        a.x*b.y - a.y*b.x
    };
}
Vec3 sub(Vec3 a, Vec3 b) { return {a.x-b.x,a.y-b.y,a.z-b.z}; }
Vec3 normalize(Vec3 v) {
    float l = std::sqrt(v.x*v.x+v.y*v.y+v.z*v.z);
    if (l < 1e-8f) return {0,1,0};
    return {v.x/l,v.y/l,v.z/l};
}

bool loadBinary(const std::string& path, std::vector<StlVertex>& out) {
    std::ifstream in(path, std::ios::binary);
    if (!in) return false;

    char header[80];
    in.read(header,80);
    uint32_t count=0;
    in.read(reinterpret_cast<char*>(&count),4);
    if (!in || count==0 || count > 10000000u) return false;

    out.clear();
    out.reserve(static_cast<size_t>(count)*3u);

    for(uint32_t i=0;i<count;i++){
        float n[3], v[9];
        uint16_t attr=0;
        in.read(reinterpret_cast<char*>(n),12);
        in.read(reinterpret_cast<char*>(v),36);
        in.read(reinterpret_cast<char*>(&attr),2);
        if(!in) return false;

        Vec3 nn = normalize({n[0],n[1],n[2]});
        if(std::abs(nn.x)+std::abs(nn.y)+std::abs(nn.z) < 0.01f){
            Vec3 a{v[0],v[1],v[2]}, b{v[3],v[4],v[5]}, c{v[6],v[7],v[8]};
            nn = normalize(cross(sub(b,a),sub(c,a)));
        }
        for(int k=0;k<3;k++){
            out.push_back({v[k*3],v[k*3+1],v[k*3+2],nn.x,nn.y,nn.z});
        }
    }
    return !out.empty();
}

bool loadAscii(const std::string& path, std::vector<StlVertex>& out) {
    std::ifstream in(path);
    if(!in) return false;

    out.clear();
    std::string token;
    Vec3 normal{0,1,0};
    while(in >> token){
        if(token=="facet"){
            in >> token;
            if(token=="normal") in >> normal.x >> normal.y >> normal.z;
            normal = normalize(normal);
        } else if(token=="vertex"){
            Vec3 p{};
            in >> p.x >> p.y >> p.z;
            out.push_back({p.x,p.y,p.z,normal.x,normal.y,normal.z});
            if(out.size() > 30000000u) return false;
        }
    }
    return out.size() >= 3;
}

} // namespace

bool loadStlMesh(const std::string& path, std::vector<StlVertex>& out) {
    std::ifstream probe(path, std::ios::binary | std::ios::ate);
    if(!probe) return false;
    auto size = static_cast<uint64_t>(probe.tellg());
    probe.seekg(80, std::ios::beg);
    uint32_t count=0;
    probe.read(reinterpret_cast<char*>(&count),4);
    bool plausibleBinary = probe.good() && count>0 &&
        (84ull + static_cast<uint64_t>(count)*50ull) <= size;
    probe.close();

    if(plausibleBinary && loadBinary(path,out)) return true;
    return loadAscii(path,out);
}

void normalizeStlMesh(std::vector<StlVertex>& vertices) {
    if(vertices.empty()) return;

    float minX=std::numeric_limits<float>::max(), minY=minX, minZ=minX;
    float maxX=-minX, maxY=-minX, maxZ=-minX;

    for(const auto& v:vertices){
        minX=std::min(minX,v.px); minY=std::min(minY,v.py); minZ=std::min(minZ,v.pz);
        maxX=std::max(maxX,v.px); maxY=std::max(maxY,v.py); maxZ=std::max(maxZ,v.pz);
    }

    const float cx=(minX+maxX)*0.5f, cy=(minY+maxY)*0.5f, cz=(minZ+maxZ)*0.5f;
    const float span=std::max({maxX-minX,maxY-minY,maxZ-minZ,1e-6f});
    const float scale=1.6f/span;

    for(auto& v:vertices){
        v.px=(v.px-cx)*scale;
        v.py=(v.py-cy)*scale;
        v.pz=(v.pz-cz)*scale;
    }
}
