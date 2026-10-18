#include "PanoramaView.h"

#include <QMatrix4x4>
#include <QMouseEvent>
#include <QWheelEvent>
#include <QtMath>

PanoramaView::PanoramaView(QWidget *parent) : QOpenGLWidget(parent) {
    setFocusPolicy(Qt::StrongFocus);
    setMouseTracking(true);
    setMinimumSize(480, 320);
}

PanoramaView::~PanoramaView() {
    makeCurrent();
    m_texture.reset();
    m_vao.destroy();
    m_vbo.destroy();
    m_ibo.destroy();
    doneCurrent();
}

bool PanoramaView::loadImage(const QString &path) {
    QImage image(path);
    if (image.isNull()) return false;
    m_pendingImage = image.convertToFormat(QImage::Format_RGBA8888);
    if (m_glReady) {
        makeCurrent();
        uploadPendingTexture();
        doneCurrent();
        update();
    }
    return true;
}

void PanoramaView::clearImage() {
    makeCurrent();
    m_texture.reset();
    doneCurrent();
    m_pendingImage = QImage();
    update();
}

void PanoramaView::setView(double yaw, double pitch, double fov) {
    m_yaw = yaw;
    m_pitch = qBound(-89.0, pitch, 89.0);
    m_fov = qBound(25.0, fov, 120.0);
    update();
}

void PanoramaView::initializeGL() {
    initializeOpenGLFunctions();
    glEnable(GL_MULTISAMPLE);
    glDisable(GL_CULL_FACE);
    glDisable(GL_DEPTH_TEST);

    const char *vs = R"(
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
    const char *fs = R"(
        #version 330 core
        in vec2 vUv;
        uniform sampler2D uTex;
        out vec4 fragColor;
        void main() {
            fragColor = texture(uTex, vUv);
        }
    )";
    m_program.addShaderFromSourceCode(QOpenGLShader::Vertex, vs);
    m_program.addShaderFromSourceCode(QOpenGLShader::Fragment, fs);
    m_program.link();

    createSphere();
    m_glReady = true;
    uploadPendingTexture();
}

void PanoramaView::createSphere() {
    constexpr int lon = 96;
    constexpr int lat = 48;
    QVector<Vertex> vertices;
    QVector<quint32> indices;
    vertices.reserve((lon + 1) * (lat + 1));

    for (int y = 0; y <= lat; ++y) {
        const float v = float(y) / lat;
        const float phi = float(-M_PI_2 + v * M_PI);
        const float cp = qCos(phi);
        const float sp = qSin(phi);
        for (int x = 0; x <= lon; ++x) {
            const float u = float(x) / lon;
            const float theta = float(-M_PI + u * 2.0 * M_PI);
            vertices.push_back({
                qSin(theta) * cp * 10.0f,
                sp * 10.0f,
                -qCos(theta) * cp * 10.0f,
                u,
                1.0f - v
            });
        }
    }
    for (int y = 0; y < lat; ++y) {
        for (int x = 0; x < lon; ++x) {
            quint32 a = y * (lon + 1) + x;
            quint32 b = a + 1;
            quint32 c = a + lon + 1;
            quint32 d = c + 1;
            indices << a << c << b << b << c << d;
        }
    }
    m_indexCount = indices.size();

    m_vao.create();
    QOpenGLVertexArrayObject::Binder binder(&m_vao);

    m_vbo.create();
    m_vbo.bind();
    m_vbo.allocate(vertices.constData(), int(vertices.size() * sizeof(Vertex)));

    m_ibo.create();
    m_ibo.bind();
    m_ibo.allocate(indices.constData(), int(indices.size() * sizeof(quint32)));

    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), nullptr);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex),
                          reinterpret_cast<void*>(3 * sizeof(float)));
}

void PanoramaView::uploadPendingTexture() {
    if (m_pendingImage.isNull()) return;
    m_texture = std::make_unique<QOpenGLTexture>(m_pendingImage.mirrored());
    m_texture->setWrapMode(QOpenGLTexture::Repeat);
    m_texture->setMinMagFilters(QOpenGLTexture::LinearMipMapLinear, QOpenGLTexture::Linear);
    m_pendingImage = QImage();
}

QMatrix4x4 PanoramaView::projectionMatrix() const {
    QMatrix4x4 p;
    const float aspect = height() > 0 ? float(width()) / float(height()) : 1.0f;
    p.perspective(float(m_fov), aspect, 0.05f, 100.0f);
    return p;
}

QMatrix4x4 PanoramaView::viewMatrix() const {
    QMatrix4x4 v;
    v.rotate(float(m_pitch), 1, 0, 0);
    v.rotate(float(-m_yaw), 0, 1, 0);
    return v;
}

void PanoramaView::resizeGL(int, int) {}

void PanoramaView::paintGL() {
    glViewport(0, 0, width(), height());
    glClearColor(0.025f, 0.03f, 0.045f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    if (!m_texture || !m_program.isLinked()) return;

    m_program.bind();
    m_program.setUniformValue("uMvp", projectionMatrix() * viewMatrix());
    m_program.setUniformValue("uTex", 0);
    m_texture->bind(0);

    QOpenGLVertexArrayObject::Binder binder(&m_vao);
    glDrawElements(GL_TRIANGLES, m_indexCount, GL_UNSIGNED_INT, nullptr);

    m_texture->release();
    m_program.release();
}

void PanoramaView::mousePressEvent(QMouseEvent *event) {
    m_lastMouse = event->pos();
    QOpenGLWidget::mousePressEvent(event);
}

void PanoramaView::mouseMoveEvent(QMouseEvent *event) {
    if (event->buttons() & Qt::LeftButton) {
        const QPoint delta = event->pos() - m_lastMouse;
        m_lastMouse = event->pos();
        m_yaw += delta.x() * 0.18;
        m_pitch = qBound(-89.0, m_pitch + delta.y() * 0.16, 89.0);
        emit viewChanged(m_yaw, m_pitch, m_fov);
        update();
    }
    QOpenGLWidget::mouseMoveEvent(event);
}

void PanoramaView::mouseDoubleClickEvent(QMouseEvent *event) {
    if (event->button() == Qt::LeftButton) {
        emit hotspotRequested(m_yaw, m_pitch);
    }
    QOpenGLWidget::mouseDoubleClickEvent(event);
}

void PanoramaView::wheelEvent(QWheelEvent *event) {
    m_fov = qBound(25.0, m_fov - event->angleDelta().y() / 120.0 * 4.0, 120.0);
    emit viewChanged(m_yaw, m_pitch, m_fov);
    update();
    event->accept();
}
