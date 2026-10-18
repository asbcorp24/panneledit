#include "PanoramaViewport.h"

#include <QFileInfo>
#include <QImageReader>
#include <QMatrix4x4>
#include <QMouseEvent>
#include <QWheelEvent>
#include <QtMath>

#include <algorithm>
#include <cmath>

namespace {
constexpr float kPi = 3.14159265358979323846f;
constexpr float kDeg = kPi / 180.0f;
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
    m_ibo.destroy();
    m_vbo.destroy();
    m_vao.destroy();
    doneCurrent();
}

void PanoramaViewport::setImage(const QString& filePath) {
    QImageReader reader(filePath);
    reader.setAutoTransform(true);

    const QSize original = reader.size();
    if (original.width() > 8192 || original.height() > 4096) {
        const QSize fitted = original.scaled(8192, 4096, Qt::KeepAspectRatio);
        reader.setScaledSize(fitted);
    }

    auto image = reader.read();
    if (image.isNull()) {
        emit imageLoadFailed("Не удалось открыть " + QFileInfo(filePath).fileName());
        return;
    }

    m_pendingImage = image.convertToFormat(QImage::Format_RGBA8888);
    m_hasPendingImage = true;
    update();
}

void PanoramaViewport::clearImage() {
    makeCurrent();
    m_texture.reset();
    doneCurrent();
    m_pendingImage = {};
    m_hasPendingImage = false;
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

    const char* vertexShader = R"(
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

    const char* fragmentShader = R"(
        #version 330 core
        in vec2 vUv;
        uniform sampler2D uTexture;
        out vec4 fragColor;
        void main() {
            fragColor = texture(uTexture, vec2(fract(vUv.x), clamp(vUv.y, 0.0, 1.0)));
        }
    )";

    m_program.addShaderFromSourceCode(QOpenGLShader::Vertex, vertexShader);
    m_program.addShaderFromSourceCode(QOpenGLShader::Fragment, fragmentShader);
    m_program.link();

    buildSphere();
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

    m_indexCount = indices.size();

    m_vao.create();
    QOpenGLVertexArrayObject::Binder vaoBinder(&m_vao);

    m_vbo.create();
    m_vbo.bind();
    m_vbo.allocate(vertices.constData(), int(vertices.size() * sizeof(Vertex)));

    m_ibo.create();
    m_ibo.bind();
    m_ibo.allocate(indices.constData(), int(indices.size() * sizeof(quint32)));

    m_program.bind();
    m_program.enableAttributeArray(0);
    m_program.setAttributeBuffer(0, GL_FLOAT, offsetof(Vertex, x), 3, sizeof(Vertex));
    m_program.enableAttributeArray(1);
    m_program.setAttributeBuffer(1, GL_FLOAT, offsetof(Vertex, u), 2, sizeof(Vertex));
    m_program.release();

    m_ibo.release();
    m_vbo.release();
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

void PanoramaViewport::paintGL() {
    uploadPendingTexture();

    glViewport(0, 0, width(), height());
    glClearColor(0.025f, 0.035f, 0.055f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    if (!m_texture || !m_program.isLinked()) return;

    m_program.bind();
    const QMatrix4x4 mvp = projectionMatrix() * viewMatrix();
    m_program.setUniformValue("uMvp", mvp);
    m_program.setUniformValue("uTexture", 0);

    glActiveTexture(GL_TEXTURE0);
    m_texture->bind();

    QOpenGLVertexArrayObject::Binder vaoBinder(&m_vao);
    m_ibo.bind();
    glDrawElements(GL_TRIANGLES, m_indexCount, GL_UNSIGNED_INT, nullptr);
    m_ibo.release();

    m_texture->release();
    m_program.release();
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

    const double scale = m_fov / std::max(200, width());
    m_yaw = std::remainder(m_yaw - delta.x() * scale * 1.3, 360.0);
    m_pitch = std::clamp(m_pitch + delta.y() * scale * 1.3, -89.0, 89.0);

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
    m_fov = std::clamp(m_fov - steps * 5.0, 30.0, 120.0);
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
    const auto [yaw, pitch] = rayToYawPitch(screenRay(event->position()));
    emit hotspotRequested(yaw, pitch);
}

void PanoramaViewport::emitViewChanged() {
    emit viewChanged(m_yaw, m_pitch, m_fov);
}
