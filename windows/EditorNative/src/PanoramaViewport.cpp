#include "PanoramaViewport.h"

#include <QMatrix4x4>
#include <QMouseEvent>
#include <QPainter>
#include <QWheelEvent>
#include <QtMath>
#include <algorithm>
#include <cmath>
#include <numbers>
#include <vector>

namespace {
struct Vertex {
    float x, y, z;
    float u, v;
};
}

PanoramaViewport::PanoramaViewport(QWidget* parent)
    : QOpenGLWidget(parent) {
    setFocusPolicy(Qt::StrongFocus);
    setMouseTracking(true);
    setMinimumSize(500, 320);
}

PanoramaViewport::~PanoramaViewport() {
    makeCurrent();
    m_texture.reset();
    m_indices.destroy();
    m_vertices.destroy();
    m_vao.destroy();
    doneCurrent();
}

void PanoramaViewport::initializeGL() {
    initializeOpenGLFunctions();
    glEnable(GL_DEPTH_TEST);
    glDisable(GL_CULL_FACE);
    glClearColor(0.018f, 0.025f, 0.043f, 1.0f);

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
            fragColor = texture(uTexture, vUv);
        }
    )";

    m_program.addShaderFromSourceCode(QOpenGLShader::Vertex, vertexShader);
    m_program.addShaderFromSourceCode(QOpenGLShader::Fragment, fragmentShader);
    m_program.link();

    buildSphere();
    uploadPendingTexture();
}

void PanoramaViewport::buildSphere() {
    constexpr int longitude = 96;
    constexpr int latitude = 48;

    std::vector<Vertex> vertices;
    std::vector<quint32> indices;
    vertices.reserve((longitude + 1) * (latitude + 1));

    for (int y = 0; y <= latitude; ++y) {
        const float v = float(y) / float(latitude);
        const float phi = float(-(std::numbers::pi_v<double> / 2.0) + v * std::numbers::pi_v<double>);
        const float cp = std::cos(phi);
        const float sp = std::sin(phi);

        for (int x = 0; x <= longitude; ++x) {
            const float u = float(x) / float(longitude);
            const float theta = float(-std::numbers::pi_v<double> + u * 2.0 * std::numbers::pi_v<double>);
            vertices.push_back(Vertex{
                std::sin(theta) * cp * 10.0f,
                sp * 10.0f,
                -std::cos(theta) * cp * 10.0f,
                u,
                1.0f - v
            });
        }
    }

    for (int y = 0; y < latitude; ++y) {
        for (int x = 0; x < longitude; ++x) {
            const quint32 a = quint32(y * (longitude + 1) + x);
            const quint32 b = a + 1;
            const quint32 c = a + longitude + 1;
            const quint32 d = c + 1;
            indices.insert(indices.end(), {a, c, b, b, c, d});
        }
    }

    m_indexCount = int(indices.size());

    m_vao.create();
    QOpenGLVertexArrayObject::Binder binder(&m_vao);

    m_vertices.create();
    m_vertices.bind();
    m_vertices.allocate(vertices.data(), int(vertices.size() * sizeof(Vertex)));

    m_indices.create();
    m_indices.bind();
    m_indices.allocate(indices.data(), int(indices.size() * sizeof(quint32)));

    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), reinterpret_cast<void*>(0));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), reinterpret_cast<void*>(3 * sizeof(float)));
}

void PanoramaViewport::resizeGL(int, int) {}

void PanoramaViewport::paintGL() {
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    if (!m_pendingImage.isNull())
        uploadPendingTexture();

    if (!m_texture || !m_program.isLinked() || m_indexCount == 0)
        return;

    const float aspect = float(std::max(1, width())) / float(std::max(1, height()));
    QMatrix4x4 projection;
    projection.perspective(float(m_fov), aspect, 0.05f, 100.0f);

    QMatrix4x4 view;
    view.rotate(float(-m_pitch), 1.0f, 0.0f, 0.0f);
    view.rotate(float(m_yaw), 0.0f, 1.0f, 0.0f);

    m_program.bind();
    m_program.setUniformValue("uMvp", projection * view);
    m_program.setUniformValue("uTexture", 0);

    glActiveTexture(GL_TEXTURE0);
    m_texture->bind();

    QOpenGLVertexArrayObject::Binder binder(&m_vao);
    glDrawElements(GL_TRIANGLES, m_indexCount, GL_UNSIGNED_INT, nullptr);

    m_texture->release();
    m_program.release();
}

void PanoramaViewport::paintEvent(QPaintEvent* event) {
    QOpenGLWidget::paintEvent(event);

    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing);
    painter.setPen(Qt::NoPen);

    for (int i = 0; i < m_hotspots.size(); ++i) {
        const QJsonObject hs = m_hotspots.at(i).toObject();
        if (hs.value("visible").toBool(true) == false)
            continue;

        const QPointF p = anglesToScreen(hs.value("yaw").toDouble(), hs.value("pitch").toDouble());
        if (p.x() < -20 || p.x() > width() + 20 || p.y() < -20 || p.y() > height() + 20)
            continue;

        const QColor color = hs.value("type").toString() == "scene"
            ? QColor("#75e7d6")
            : hs.value("type").toString() == "url"
                ? QColor("#ffb86c")
                : QColor("#8fb5ff");

        painter.setBrush(QColor(5, 10, 20, 210));
        painter.drawEllipse(p, 17, 17);
        painter.setBrush(color);
        painter.drawEllipse(p, 10, 10);
        painter.setPen(QPen(Qt::white, 1));
        const QString label = hs.value("text").toString();
        if (!label.isEmpty())
            painter.drawText(QRectF(p.x() - 70, p.y() + 20, 140, 24), Qt::AlignHCenter | Qt::AlignTop, label);
        painter.setPen(Qt::NoPen);
    }

    painter.setPen(QPen(QColor(255,255,255,150), 1));
    painter.drawLine(width()/2 - 7, height()/2, width()/2 + 7, height()/2);
    painter.drawLine(width()/2, height()/2 - 7, width()/2, height()/2 + 7);
}

void PanoramaViewport::setPanorama(const QImage& image) {
    m_pendingImage = image.convertToFormat(QImage::Format_RGBA8888);
    if (isValid()) {
        makeCurrent();
        uploadPendingTexture();
        doneCurrent();
    }
    update();
}

void PanoramaViewport::clearPanorama() {
    m_pendingImage = {};
    if (isValid()) {
        makeCurrent();
        m_texture.reset();
        doneCurrent();
    }
    update();
}

void PanoramaViewport::uploadPendingTexture() {
    if (m_pendingImage.isNull())
        return;

    m_texture = std::make_unique<QOpenGLTexture>(m_pendingImage.mirrored());
    m_texture->setMinificationFilter(QOpenGLTexture::LinearMipMapLinear);
    m_texture->setMagnificationFilter(QOpenGLTexture::Linear);
    m_texture->setWrapMode(QOpenGLTexture::DirectionS, QOpenGLTexture::Repeat);
    m_texture->setWrapMode(QOpenGLTexture::DirectionT, QOpenGLTexture::ClampToEdge);
    m_texture->generateMipMaps();
    m_pendingImage = {};
}

void PanoramaViewport::setView(double yaw, double pitch, double fov) {
    m_yaw = wrapYaw(yaw);
    m_pitch = clampPitch(pitch);
    m_fov = std::clamp(fov, 30.0, 120.0);
    update();
}

void PanoramaViewport::setHotspots(const QJsonArray& hotspots) {
    m_hotspots = hotspots;
    update();
}

double PanoramaViewport::wrapYaw(double value) {
    while (value > 180.0) value -= 360.0;
    while (value < -180.0) value += 360.0;
    return value;
}

double PanoramaViewport::clampPitch(double value) {
    return std::clamp(value, -89.0, 89.0);
}

QPointF PanoramaViewport::screenToAngles(const QPointF& pos) const {
    const double aspect = double(std::max(1, width())) / double(std::max(1, height()));
    const double verticalFov = qDegreesToRadians(m_fov);
    const double horizontalFov = 2.0 * std::atan(std::tan(verticalFov * 0.5) * aspect);

    const double nx = (pos.x() / std::max(1, width()) - 0.5) * 2.0;
    const double ny = (0.5 - pos.y() / std::max(1, height())) * 2.0;

    const double yawDelta = qRadiansToDegrees(std::atan(nx * std::tan(horizontalFov * 0.5)));
    const double pitchDelta = qRadiansToDegrees(std::atan(ny * std::tan(verticalFov * 0.5)));
    return QPointF(wrapYaw(m_yaw + yawDelta), clampPitch(m_pitch + pitchDelta));
}

QPointF PanoramaViewport::anglesToScreen(double yaw, double pitch) const {
    const double aspect = double(std::max(1, width())) / double(std::max(1, height()));
    const double vf = qDegreesToRadians(m_fov);
    const double hf = 2.0 * std::atan(std::tan(vf * 0.5) * aspect);

    const double dy = qDegreesToRadians(wrapYaw(yaw - m_yaw));
    const double dp = qDegreesToRadians(pitch - m_pitch);

    if (std::abs(dy) > (std::numbers::pi_v<double> / 2.0))
        return QPointF(-10000, -10000);

    const double nx = std::tan(dy) / std::tan(hf * 0.5);
    const double ny = std::tan(dp) / std::tan(vf * 0.5);

    return QPointF((nx * 0.5 + 0.5) * width(), (0.5 - ny * 0.5) * height());
}

void PanoramaViewport::mousePressEvent(QMouseEvent* event) {
    if (event->button() == Qt::LeftButton) {
        // Hotspot hit-test first.
        for (int i = m_hotspots.size() - 1; i >= 0; --i) {
            const QJsonObject hs = m_hotspots.at(i).toObject();
            const QPointF p = anglesToScreen(hs.value("yaw").toDouble(), hs.value("pitch").toDouble());
            if (QLineF(p, event->position()).length() <= 18.0) {
                emit hotspotClicked(i);
                return;
            }
        }
        m_dragging = true;
        m_lastMouse = event->pos();
        setCursor(Qt::ClosedHandCursor);
    }
}

void PanoramaViewport::mouseMoveEvent(QMouseEvent* event) {
    if (!m_dragging)
        return;
    const QPoint delta = event->pos() - m_lastMouse;
    m_lastMouse = event->pos();

    const double scale = m_fov / std::max(300, height());
    m_yaw = wrapYaw(m_yaw - delta.x() * scale);
    m_pitch = clampPitch(m_pitch + delta.y() * scale);
    emit viewChanged(m_yaw, m_pitch, m_fov);
    update();
}

void PanoramaViewport::mouseReleaseEvent(QMouseEvent* event) {
    if (event->button() == Qt::LeftButton) {
        m_dragging = false;
        unsetCursor();
    }
}

void PanoramaViewport::mouseDoubleClickEvent(QMouseEvent* event) {
    if (event->button() != Qt::LeftButton)
        return;
    const QPointF angles = screenToAngles(event->position());
    emit addHotspotRequested(angles.x(), angles.y());
}

void PanoramaViewport::wheelEvent(QWheelEvent* event) {
    const double steps = event->angleDelta().y() / 120.0;
    m_fov = std::clamp(m_fov - steps * 5.0, 30.0, 120.0);
    emit viewChanged(m_yaw, m_pitch, m_fov);
    update();
}
