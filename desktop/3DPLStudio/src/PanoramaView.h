#pragma once

#include <QImage>
#include <QOpenGLBuffer>
#include <QOpenGLFunctions_3_3_Core>
#include <QOpenGLShaderProgram>
#include <QOpenGLTexture>
#include <QOpenGLVertexArrayObject>
#include <QOpenGLWidget>

class PanoramaView final : public QOpenGLWidget, protected QOpenGLFunctions_3_3_Core {
    Q_OBJECT
public:
    explicit PanoramaView(QWidget *parent = nullptr);
    ~PanoramaView() override;

    bool loadImage(const QString &path);
    void clearImage();

    double yaw() const { return m_yaw; }
    double pitch() const { return m_pitch; }
    double fov() const { return m_fov; }

    void setView(double yaw, double pitch, double fov);

signals:
    void viewChanged(double yaw, double pitch, double fov);
    void hotspotRequested(double yaw, double pitch);

protected:
    void initializeGL() override;
    void resizeGL(int w, int h) override;
    void paintGL() override;
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseDoubleClickEvent(QMouseEvent *event) override;
    void wheelEvent(QWheelEvent *event) override;

private:
    struct Vertex { float x,y,z,u,v; };

    void createSphere();
    void uploadPendingTexture();
    QMatrix4x4 projectionMatrix() const;
    QMatrix4x4 viewMatrix() const;

    QOpenGLShaderProgram m_program;
    QOpenGLVertexArrayObject m_vao;
    QOpenGLBuffer m_vbo{QOpenGLBuffer::VertexBuffer};
    QOpenGLBuffer m_ibo{QOpenGLBuffer::IndexBuffer};
    std::unique_ptr<QOpenGLTexture> m_texture;
    QImage m_pendingImage;
    int m_indexCount = 0;
    bool m_glReady = false;

    QPoint m_lastMouse;
    double m_yaw = 0.0;
    double m_pitch = 0.0;
    double m_fov = 100.0;
};
