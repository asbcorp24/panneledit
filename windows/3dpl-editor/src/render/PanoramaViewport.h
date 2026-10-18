#pragma once

#include <QImage>
#include <QOpenGLBuffer>
#include <QOpenGLFunctions_3_3_Core>
#include <QOpenGLShaderProgram>
#include <QOpenGLTexture>
#include <QOpenGLVertexArrayObject>
#include <QOpenGLWidget>
#include <QPoint>

class PanoramaViewport final
    : public QOpenGLWidget
    , protected QOpenGLFunctions_3_3_Core
{
    Q_OBJECT

public:
    explicit PanoramaViewport(QWidget* parent = nullptr);
    ~PanoramaViewport() override;

    void setImage(const QString& filePath);
    void clearImage();

    void setView(double yaw, double pitch, double fov);
    double yaw() const { return m_yaw; }
    double pitch() const { return m_pitch; }
    double fov() const { return m_fov; }

signals:
    void viewChanged(double yaw, double pitch, double fov);
    void hotspotRequested(double yaw, double pitch);
    void imageLoadFailed(const QString& message);

protected:
    void initializeGL() override;
    void resizeGL(int width, int height) override;
    void paintGL() override;

    void mousePressEvent(QMouseEvent* event) override;
    void mouseMoveEvent(QMouseEvent* event) override;
    void mouseReleaseEvent(QMouseEvent* event) override;
    void mouseDoubleClickEvent(QMouseEvent* event) override;
    void wheelEvent(QWheelEvent* event) override;

private:
    struct Vertex {
        float x, y, z;
        float u, v;
    };

    void buildSphere();
    void uploadPendingTexture();
    void emitViewChanged();

    QMatrix4x4 projectionMatrix() const;
    QMatrix4x4 viewMatrix() const;
    QVector3D screenRay(const QPointF& pos) const;
    QPair<double, double> rayToYawPitch(const QVector3D& ray) const;

    QOpenGLShaderProgram m_program;
    QOpenGLVertexArrayObject m_vao;
    QOpenGLBuffer m_vbo{QOpenGLBuffer::VertexBuffer};
    QOpenGLBuffer m_ibo{QOpenGLBuffer::IndexBuffer};
    std::unique_ptr<QOpenGLTexture> m_texture;
    int m_indexCount = 0;

    QImage m_pendingImage;
    bool m_hasPendingImage = false;

    double m_yaw = 0.0;
    double m_pitch = 0.0;
    double m_fov = 100.0;

    bool m_dragging = false;
    QPoint m_lastMouse;
};
