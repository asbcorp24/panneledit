#pragma once

#include <QJsonArray>
#include <QOpenGLBuffer>
#include <QOpenGLFunctions_3_3_Core>
#include <QOpenGLShaderProgram>
#include <QOpenGLTexture>
#include <QOpenGLVertexArrayObject>
#include <QOpenGLWidget>
#include <QPoint>

class PanoramaViewport final : public QOpenGLWidget, protected QOpenGLFunctions_3_3_Core {
    Q_OBJECT
public:
    explicit PanoramaViewport(QWidget* parent = nullptr);
    ~PanoramaViewport() override;

    void setPanorama(const QImage& image);
    void clearPanorama();
    void setView(double yaw, double pitch, double fov);
    void setHotspots(const QJsonArray& hotspots);

    double yaw() const { return m_yaw; }
    double pitch() const { return m_pitch; }
    double fov() const { return m_fov; }

    QPointF screenToAngles(const QPointF& pos) const;
    QPointF anglesToScreen(double yaw, double pitch) const;

Q_SIGNALS:
    void viewChanged(double yaw, double pitch, double fov);
    void addHotspotRequested(double yaw, double pitch);
    void hotspotClicked(int index);

protected:
    void initializeGL() override;
    void resizeGL(int w, int h) override;
    void paintGL() override;
    void paintEvent(QPaintEvent* event) override;
    void mousePressEvent(QMouseEvent* event) override;
    void mouseMoveEvent(QMouseEvent* event) override;
    void mouseReleaseEvent(QMouseEvent* event) override;
    void mouseDoubleClickEvent(QMouseEvent* event) override;
    void wheelEvent(QWheelEvent* event) override;

private:
    void buildSphere();
    void uploadPendingTexture();
    static double wrapYaw(double value);
    static double clampPitch(double value);

    QOpenGLShaderProgram m_program;
    QOpenGLVertexArrayObject m_vao;
    QOpenGLBuffer m_vertices{QOpenGLBuffer::VertexBuffer};
    QOpenGLBuffer m_indices{QOpenGLBuffer::IndexBuffer};
    std::unique_ptr<QOpenGLTexture> m_texture;
    QImage m_pendingImage;
    int m_indexCount = 0;

    double m_yaw = 0.0;
    double m_pitch = 0.0;
    double m_fov = 100.0;

    bool m_dragging = false;
    QPoint m_lastMouse;
    QJsonArray m_hotspots;
};
