#include "PanoramaViewport.h"

#include <QFileInfo>
#include <QImageReader>
#include <QMouseEvent>
#include <QVector4D>
#include <QWheelEvent>
#include <QtMath>

#include <algorithm>
#include <cmath>

namespace {
constexpr float kPi = 3.14159265358979323846f;

int wrapIndex(int value, int count) {
    if (count <= 0) return 0;
    value %= count;
    if (value < 0) value += count;
    return value;
}

QPointF projectPoint(const QMatrix4x4& mvp, const QVector3D& point, int width, int height) {
    QVector4D p = mvp * QVector4D(point, 1.0f);
    if (qFuzzyIsNull(p.w())) return {};
    p /= p.w();
    return {
        (p.x() * 0.5 + 0.5) * width,
        (1.0 - (p.y() * 0.5 + 0.5)) * height
    };
}
}

PanoramaViewport::PanoramaViewport(QWidget* parent)
    : QOpenGLWidget(parent)
{
    setFocusPolicy(Qt::StrongFocus);
    setMouseTracking(true);
}

PanoramaViewport::~PanoramaViewport() {
    makeCurrent();
    m_texture.reset();
    m_stlVbo.destroy();
    m_stlVao.destroy();
    m_quadIbo.destroy();
    m_quadVbo.destroy();
    m_quadVao.destroy();
    m_sphereIbo.destroy();
    m_sphereVbo.destroy();
    m_sphereVao.destroy();
    doneCurrent();
}

void PanoramaViewport::setImage(const QString& filePath) {
    setPanoramaImage(filePath, "360");
}

bool PanoramaViewport::loadImage(const QString& filePath) {
    QImageReader reader(filePath);
    reader.setAutoTransform(true);

    const QSize original = reader.size();
    int maxW = 8192;
    int maxH = 4096;
    if (m_mode == Mode::Object360) {
        maxW = 4096;
        maxH = 4096;
    }

    if (original.isValid() && (original.width() > maxW || original.height() > maxH)) {
        reader.setScaledSize(original.scaled(maxW, maxH, Qt::KeepAspectRatio));
    }

    auto image = reader.read();
    if (image.isNull()) {
        emit imageLoadFailed("Не удалось открыть " + QFileInfo(filePath).fileName());
        return false;
    }

    if (image.height() > 0)
        m_objectAspect = double(image.width()) / double(image.height());

    m_pendingImage = image.convertToFormat(QImage::Format_RGBA8888);
    m_hasPendingImage = true;
    update();
    return true;
}

void PanoramaViewport::setPanoramaImage(const QString& filePath, const QString& projection) {
    m_mode = Mode::Panorama;
    m_projection = projection.toUpper();
    m_objectFrames.clear();
    loadImage(filePath);
}

void PanoramaViewport::setObject360(
    const QVector<QVector<QString>>& framePaths,
    int startSector,
    int startRow
) {
    m_mode = Mode::Object360;
    m_projection = "FLAT";
    m_objectFrames = framePaths;
    m_objectDragX = 0;
    m_objectDragY = 0;

    if (m_objectFrames.isEmpty()) {
        clearImage();
        return;
    }

    m_objectRow = std::clamp(startRow, 0, int(m_objectFrames.size()) - 1);
    const int sectorCount = int(m_objectFrames.at(m_objectRow).size());
    m_objectSector = sectorCount > 0 ? wrapIndex(startSector, sectorCount) : 0;
    loadObjectFrame(m_objectSector, m_objectRow);
}

void PanoramaViewport::setStl(
    const QString& filePath,
    const QColor& color,
    bool wireframe,
    double zoom
) {
    QVector<StlVertex> vertices;
    QString error;
    if (!StlMesh::load(filePath, vertices, &error)) {
        emit stlLoadFailed(error);
        m_mode = Mode::Empty;
        update();
        return;
    }

    m_mode = Mode::Stl;
    m_stlColor = color;
    m_stlWireframe = wireframe;
    m_stlZoom = std::clamp(zoom, 0.35, 5.0);
    m_pendingStl = std::move(vertices);
    m_hasPendingStl = true;
    m_texture.reset();
    update();
}

void PanoramaViewport::setStlStyle(const QColor& color, bool wireframe, double zoom) {
    m_stlColor = color;
    m_stlWireframe = wireframe;
    m_stlZoom = std::clamp(zoom, 0.35, 5.0);
    update();
}

void PanoramaViewport::clearImage() {
    makeCurrent();
    m_texture.reset();
    if (m_stlVbo.isCreated()) {
        m_stlVbo.bind();
        m_stlVbo.allocate(nullptr, 0);
        m_stlVbo.release();
    }
    doneCurrent();

    m_mode = Mode::Empty;
    m_pendingImage = {};
    m_hasPendingImage = false;
    m_pendingStl.clear();
    m_hasPendingStl = false;
    m_objectFrames.clear();
    m_stlVertexCount = 0;
    update();
}

void PanoramaViewport::setView(double yaw, double pitch, double fov) {
    m_yaw = std::remainder(yaw, 360.0);
    m_pitch = std::clamp(pitch, -89.0, 89.0);
    m_fov = std::clamp(fov, 30.0, 120.0);
    emitViewChanged();
    update();
}

void PanoramaViewport::initializeGL() {
    initializeOpenGLFunctions();
    glEnable(GL_DEPTH_TEST);
    glDisable(GL_CULL_FACE);

    const char* textureVertexShader = R"(
        #version 330 core
        layout(location=0) in vec3 aPos;
        layout(location=1) in vec2 aUv;
        uniform mat4 uMvp;
        out vec2 vUv;
        void main() {
            vUv = aUv;
            gl_Position = uMvp * vec4(aPos, 1.0);
        }
    )";

    const char* textureFragmentShader = R"(
        #version 330 core
        in vec2 vUv;
        uniform sampler2D uTexture;
        uniform vec2 uUvScale;
        uniform vec2 uUvOffset;
        uniform int uHalfSphere;
        out vec4 fragColor;
        void main() {
            float u = fract(vUv.x);
            if (uHalfSphere == 1) {
                float d = u - 0.5;
                if (abs(d) > 0.25) discard;
                u = (u - 0.25) * 2.0;
            }
            vec2 uv = vec2(u, clamp(vUv.y, 0.0, 1.0)) * uUvScale + uUvOffset;
            fragColor = texture(uTexture, uv);
        }
    )";

    const char* stlVertexShader = R"(
        #version 330 core
        layout(location=0) in vec3 aPos;
        layout(location=1) in vec3 aNormal;
        uniform mat4 uMvp;
        uniform mat4 uModel;
        out vec3 vNormal;
        out vec3 vWorld;
        void main() {
            vec4 world = uModel * vec4(aPos, 1.0);
            vWorld = world.xyz;
            vNormal = mat3(transpose(inverse(uModel))) * aNormal;
            gl_Position = uMvp * vec4(aPos, 1.0);
        }
    )";

    const char* stlFragmentShader = R"(
        #version 330 core
        in vec3 vNormal;
        in vec3 vWorld;
        uniform vec3 uColor;
        out vec4 fragColor;
        void main() {
            vec3 n = normalize(vNormal);
            vec3 lightDir = normalize(vec3(0.35, 0.75, 0.55));
            float diffuse = max(dot(n, lightDir), 0.0);
            float rim = pow(1.0 - max(abs(n.z), 0.0), 2.0);
            float light = 0.26 + diffuse * 0.68 + rim * 0.12;
            fragColor = vec4(uColor * light, 1.0);
        }
    )";

    m_textureProgram.addShaderFromSourceCode(QOpenGLShader::Vertex, textureVertexShader);
    m_textureProgram.addShaderFromSourceCode(QOpenGLShader::Fragment, textureFragmentShader);
    m_textureProgram.link();

    m_stlProgram.addShaderFromSourceCode(QOpenGLShader::Vertex, stlVertexShader);
    m_stlProgram.addShaderFromSourceCode(QOpenGLShader::Fragment, stlFragmentShader);
    m_stlProgram.link();

    buildSphere();
    buildQuad();

    m_stlVao.create();
    m_stlVbo.create();
}

void PanoramaViewport::buildSphere() {
    constexpr int lon = 96;
    constexpr int lat = 48;

    QVector<Vertex> vertices;
    QVector<quint32> indices;
    vertices.reserve((lon + 1) * (lat + 1));
    indices.reserve(lon * lat * 6);

    for (int y = 0; y <= lat; ++y) {
        const float v = float(y) / float(lat);
        const float phi = -kPi * 0.5f + v * kPi;
        const float cp = std::cos(phi);
        const float sp = std::sin(phi);

        for (int x = 0; x <= lon; ++x) {
            const float u = float(x) / float(lon);
            const float theta = -kPi + u * 2.0f * kPi;
            vertices.push_back(Vertex{
                std::sin(theta) * cp * 10.0f,
                sp * 10.0f,
                -std::cos(theta) * cp * 10.0f,
                u,
                1.0f - v
            });
        }
    }

    for (int y = 0; y < lat; ++y) {
        for (int x = 0; x < lon; ++x) {
            const quint32 a = y * (lon + 1) + x;
            const quint32 b = a + 1;
            const quint32 c = a + lon + 1;
            const quint32 d = c + 1;
            indices << a << c << b << b << c << d;
        }
    }

    m_sphereIndexCount = int(indices.size());

    m_sphereVao.create();
    QOpenGLVertexArrayObject::Binder vaoBinder(&m_sphereVao);

    m_sphereVbo.create();
    m_sphereVbo.bind();
    m_sphereVbo.allocate(vertices.constData(), int(vertices.size() * sizeof(Vertex)));

    m_sphereIbo.create();
    m_sphereIbo.bind();
    m_sphereIbo.allocate(indices.constData(), int(indices.size() * sizeof(quint32)));

    m_textureProgram.bind();
    m_textureProgram.enableAttributeArray(0);
    m_textureProgram.setAttributeBuffer(0, GL_FLOAT, offsetof(Vertex, x), 3, sizeof(Vertex));
    m_textureProgram.enableAttributeArray(1);
    m_textureProgram.setAttributeBuffer(1, GL_FLOAT, offsetof(Vertex, u), 2, sizeof(Vertex));
    m_textureProgram.release();

    m_sphereIbo.release();
    m_sphereVbo.release();
}

void PanoramaViewport::buildQuad() {
    const Vertex vertices[]{
        {-1, -1, 0, 0, 1},
        { 1, -1, 0, 1, 1},
        { 1,  1, 0, 1, 0},
        {-1,  1, 0, 0, 0}
    };
    const quint16 indices[]{0, 1, 2, 0, 2, 3};

    m_quadVao.create();
    QOpenGLVertexArrayObject::Binder vaoBinder(&m_quadVao);

    m_quadVbo.create();
    m_quadVbo.bind();
    m_quadVbo.allocate(vertices, int(sizeof(vertices)));

    m_quadIbo.create();
    m_quadIbo.bind();
    m_quadIbo.allocate(indices, int(sizeof(indices)));

    m_textureProgram.bind();
    m_textureProgram.enableAttributeArray(0);
    m_textureProgram.setAttributeBuffer(0, GL_FLOAT, offsetof(Vertex, x), 3, sizeof(Vertex));
    m_textureProgram.enableAttributeArray(1);
    m_textureProgram.setAttributeBuffer(1, GL_FLOAT, offsetof(Vertex, u), 2, sizeof(Vertex));
    m_textureProgram.release();

    m_quadIbo.release();
    m_quadVbo.release();
}

void PanoramaViewport::resizeGL(int, int) {}

QMatrix4x4 PanoramaViewport::projectionMatrix() const {
    QMatrix4x4 p;
    const float aspect = height() > 0 ? float(width()) / float(height()) : 1.0f;
    p.perspective(float(m_fov), aspect, 0.05f, 50.0f);
    return p;
}

QMatrix4x4 PanoramaViewport::viewMatrix() const {
    QMatrix4x4 v;
    v.rotate(float(-m_pitch), 1.0f, 0.0f, 0.0f);
    v.rotate(float(m_yaw), 0.0f, 1.0f, 0.0f);
    return v;
}

void PanoramaViewport::uploadPendingTexture() {
    if (!m_hasPendingImage || m_pendingImage.isNull()) return;

    m_texture = std::make_unique<QOpenGLTexture>(m_pendingImage);
    m_texture->setMinificationFilter(QOpenGLTexture::LinearMipMapLinear);
    m_texture->setMagnificationFilter(QOpenGLTexture::Linear);
    m_texture->setWrapMode(QOpenGLTexture::DirectionS, QOpenGLTexture::Repeat);
    m_texture->setWrapMode(QOpenGLTexture::DirectionT, QOpenGLTexture::ClampToEdge);
    m_texture->generateMipMaps();

    m_pendingImage = {};
    m_hasPendingImage = false;
}

void PanoramaViewport::uploadPendingStl() {
    if (!m_hasPendingStl) return;

    QOpenGLVertexArrayObject::Binder vaoBinder(&m_stlVao);
    m_stlVbo.bind();
    m_stlVbo.allocate(
        m_pendingStl.constData(),
        int(m_pendingStl.size() * qsizetype(sizeof(StlVertex)))
    );

    m_stlProgram.bind();
    m_stlProgram.enableAttributeArray(0);
    m_stlProgram.setAttributeBuffer(0, GL_FLOAT, offsetof(StlVertex, px), 3, sizeof(StlVertex));
    m_stlProgram.enableAttributeArray(1);
    m_stlProgram.setAttributeBuffer(1, GL_FLOAT, offsetof(StlVertex, nx), 3, sizeof(StlVertex));
    m_stlProgram.release();
    m_stlVbo.release();

    m_stlVertexCount = int(m_pendingStl.size());
    m_pendingStl.clear();
    m_hasPendingStl = false;
}

void PanoramaViewport::paintGL() {
    uploadPendingTexture();
    uploadPendingStl();

    glViewport(0, 0, width(), height());
    glClearColor(0.025f, 0.035f, 0.055f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    switch (m_mode) {
    case Mode::Panorama:
        renderSphere();
        break;
    case Mode::Object360:
        renderObject();
        break;
    case Mode::Stl:
        renderStl();
        break;
    case Mode::Empty:
    default:
        break;
    }
}

void PanoramaViewport::renderSphere() {
    if (!m_texture || !m_textureProgram.isLinked()) return;

    m_textureProgram.bind();
    const QMatrix4x4 mvp = projectionMatrix() * viewMatrix();
    m_textureProgram.setUniformValue("uMvp", mvp);
    m_textureProgram.setUniformValue("uTexture", 0);

    QVector2D uvScale(1, 1);
    QVector2D uvOffset(0, 0);
    if (m_projection.endsWith("_LR")) {
        uvScale.setX(0.5f); // left eye preview
    } else if (m_projection.endsWith("_TB")) {
        uvScale.setY(0.5f);
        uvOffset.setY(0.5f); // top image as left-eye preview
    }
    m_textureProgram.setUniformValue("uUvScale", uvScale);
    m_textureProgram.setUniformValue("uUvOffset", uvOffset);
    m_textureProgram.setUniformValue("uHalfSphere", m_projection.startsWith("180") ? 1 : 0);

    glActiveTexture(GL_TEXTURE0);
    m_texture->bind();

    QOpenGLVertexArrayObject::Binder vaoBinder(&m_sphereVao);
    m_sphereIbo.bind();
    glDrawElements(GL_TRIANGLES, m_sphereIndexCount, GL_UNSIGNED_INT, nullptr);
    m_sphereIbo.release();

    m_texture->release();
    m_textureProgram.release();
}

void PanoramaViewport::renderObject() {
    if (!m_texture || !m_textureProgram.isLinked()) return;

    QMatrix4x4 model;
    model.translate(0.0f, 0.0f, -2.55f);

    const double viewAspect = height() > 0 ? double(width()) / double(height()) : 1.0;
    double sx = 1.05 * m_objectAspect;
    double sy = 1.05;
    if (sx / sy > viewAspect * 0.94)
        sy = sx / std::max(0.2, viewAspect * 0.94);

    model.scale(float(sx), float(sy), 1.0f);

    m_textureProgram.bind();
    m_textureProgram.setUniformValue("uMvp", projectionMatrix() * model);
    m_textureProgram.setUniformValue("uTexture", 0);
    m_textureProgram.setUniformValue("uUvScale", QVector2D(1, 1));
    m_textureProgram.setUniformValue("uUvOffset", QVector2D(0, 0));
    m_textureProgram.setUniformValue("uHalfSphere", 0);

    glActiveTexture(GL_TEXTURE0);
    m_texture->bind();

    QOpenGLVertexArrayObject::Binder vaoBinder(&m_quadVao);
    m_quadIbo.bind();
    glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_SHORT, nullptr);
    m_quadIbo.release();

    m_texture->release();
    m_textureProgram.release();
}

void PanoramaViewport::renderStl() {
    if (m_stlVertexCount <= 0 || !m_stlProgram.isLinked()) return;

    QMatrix4x4 model;
    model.translate(0.0f, -0.05f, -2.65f);
    model.rotate(float(m_yaw), 0, 1, 0);
    model.rotate(float(m_pitch), 1, 0, 0);
    model.scale(float(m_stlZoom));

    m_stlProgram.bind();
    m_stlProgram.setUniformValue("uModel", model);
    m_stlProgram.setUniformValue("uMvp", projectionMatrix() * model);
    m_stlProgram.setUniformValue(
        "uColor",
        QVector3D(
            m_stlColor.redF(),
            m_stlColor.greenF(),
            m_stlColor.blueF()
        )
    );

    QOpenGLVertexArrayObject::Binder vaoBinder(&m_stlVao);
    glPolygonMode(GL_FRONT_AND_BACK, m_stlWireframe ? GL_LINE : GL_FILL);
    glDrawArrays(GL_TRIANGLES, 0, m_stlVertexCount);
    glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);

    m_stlProgram.release();
}

void PanoramaViewport::loadObjectFrame(int sector, int row) {
    if (m_objectFrames.isEmpty()) return;

    row = std::clamp(row, 0, int(m_objectFrames.size()) - 1);
    const auto& frames = m_objectFrames.at(row);
    if (frames.isEmpty()) return;

    sector = wrapIndex(sector, int(frames.size()));
    if (loadImage(frames.at(sector))) {
        m_objectRow = row;
        m_objectSector = sector;
        emit objectFrameChanged(sector, row);
    }
}

void PanoramaViewport::mousePressEvent(QMouseEvent* event) {
    if (event->button() == Qt::LeftButton) {
        m_dragging = true;
        m_lastMouse = event->position().toPoint();
        setCursor(Qt::ClosedHandCursor);
    }
}

void PanoramaViewport::mouseMoveEvent(QMouseEvent* event) {
    if (!m_dragging) return;

    const QPoint current = event->position().toPoint();
    const QPoint delta = current - m_lastMouse;
    m_lastMouse = current;

    if (m_mode == Mode::Object360) {
        m_objectDragX += delta.x();
        m_objectDragY += delta.y();

        if (!m_objectFrames.isEmpty()) {
            if (std::abs(m_objectDragX) >= 18.0) {
                const int steps = int(m_objectDragX / 18.0);
                m_objectDragX -= steps * 18.0;
                loadObjectFrame(m_objectSector - steps, m_objectRow);
            }

            if (m_objectFrames.size() > 1 && std::abs(m_objectDragY) >= 28.0) {
                const int steps = int(m_objectDragY / 28.0);
                m_objectDragY -= steps * 28.0;
                loadObjectFrame(m_objectSector, m_objectRow + steps);
            }
        }
        return;
    }

    if (m_mode == Mode::Stl) {
        m_yaw = std::remainder(m_yaw + delta.x() * 0.45, 360.0);
        m_pitch = std::clamp(m_pitch + delta.y() * 0.35, -89.0, 89.0);
    } else {
        const double scale = m_fov / std::max(200, width());
        m_yaw = std::remainder(m_yaw - delta.x() * scale * 1.3, 360.0);
        m_pitch = std::clamp(m_pitch + delta.y() * scale * 1.3, -89.0, 89.0);
    }

    emitViewChanged();
    update();
}

void PanoramaViewport::mouseReleaseEvent(QMouseEvent* event) {
    if (event->button() == Qt::LeftButton) {
        m_dragging = false;
        unsetCursor();
    }
}

void PanoramaViewport::wheelEvent(QWheelEvent* event) {
    const double steps = event->angleDelta().y() / 120.0;

    if (m_mode == Mode::Stl) {
        m_stlZoom = std::clamp(m_stlZoom * std::pow(1.08, steps), 0.35, 5.0);
    } else {
        m_fov = std::clamp(m_fov - steps * 5.0, 30.0, 120.0);
    }

    emitViewChanged();
    update();
    event->accept();
}

QVector3D PanoramaViewport::screenRay(const QPointF& pos) const {
    const float x = float(2.0 * pos.x() / std::max(1, width()) - 1.0);
    const float y = float(1.0 - 2.0 * pos.y() / std::max(1, height()));

    bool ok = false;
    const QMatrix4x4 inv = (projectionMatrix() * viewMatrix()).inverted(&ok);
    if (!ok) return QVector3D(0, 0, -1);

    QVector4D nearPoint = inv * QVector4D(x, y, -1.0f, 1.0f);
    QVector4D farPoint = inv * QVector4D(x, y, 1.0f, 1.0f);
    nearPoint /= nearPoint.w();
    farPoint /= farPoint.w();

    return (farPoint.toVector3D() - nearPoint.toVector3D()).normalized();
}

QPair<double, double> PanoramaViewport::rayToYawPitch(const QVector3D& ray) const {
    const double yaw = qRadiansToDegrees(std::atan2(double(ray.x()), double(-ray.z())));
    const double pitch = qRadiansToDegrees(std::asin(std::clamp(double(ray.y()), -1.0, 1.0)));
    return {yaw, pitch};
}

void PanoramaViewport::mouseDoubleClickEvent(QMouseEvent* event) {
    if (event->button() != Qt::LeftButton) return;

    if (m_mode == Mode::Object360) {
        QMatrix4x4 model;
        model.translate(0.0f, 0.0f, -2.55f);

        const double viewAspect = height() > 0 ? double(width()) / double(height()) : 1.0;
        double sx = 1.05 * m_objectAspect;
        double sy = 1.05;
        if (sx / sy > viewAspect * 0.94)
            sy = sx / std::max(0.2, viewAspect * 0.94);
        model.scale(float(sx), float(sy), 1.0f);

        const QMatrix4x4 mvp = projectionMatrix() * model;
        const QPointF topLeft = projectPoint(mvp, QVector3D(-1, 1, 0), width(), height());
        const QPointF bottomRight = projectPoint(mvp, QVector3D(1, -1, 0), width(), height());

        const double w = bottomRight.x() - topLeft.x();
        const double h = bottomRight.y() - topLeft.y();
        if (w > 1 && h > 1) {
            const double x = std::clamp((event->position().x() - topLeft.x()) / w * 100.0, 0.0, 100.0);
            const double y = std::clamp((event->position().y() - topLeft.y()) / h * 100.0, 0.0, 100.0);
            emit objectHotspotRequested(x, y, m_objectSector, m_objectRow);
        }
        return;
    }

    const auto [yaw, pitch] = rayToYawPitch(screenRay(event->position()));
    emit hotspotRequested(yaw, pitch);
}

void PanoramaViewport::emitViewChanged() {
    emit viewChanged(m_yaw, m_pitch, m_fov);
}
