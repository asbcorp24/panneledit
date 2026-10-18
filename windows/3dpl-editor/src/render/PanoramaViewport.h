#pragma once

#include "StlMesh.h"
#include "model/Hotspot.h"

#include <QColor>
#include <QImage>
#include <QJsonArray>
#include <QHash>
#include <QMatrix4x4>
#include <QOpenGLBuffer>
#include <QOpenGLFunctions_3_3_Core>
#include <QOpenGLShaderProgram>
#include <QOpenGLTexture>
#include <QOpenGLVertexArrayObject>
#include <QOpenGLWidget>
#include <QPoint>
#include <QStringList>
#include <memory>

class QPainter;
class QPaintEvent;

class PanoramaViewport final
    : public QOpenGLWidget
    , protected QOpenGLFunctions_3_3_Core
{
    Q_OBJECT

public:
    enum class Mode {
        Empty,
        Panorama,
        Object360,
        Stl
    };

    explicit PanoramaViewport(QWidget* parent = nullptr);
    ~PanoramaViewport() override;

    void setImage(const QString& filePath);
    void setPanoramaImage(const QString& filePath, const QString& projection = "360");
    void setVideoFrame(const QImage& frame, const QString& projection);
    void setObject360(
        const QVector<QVector<QString>>& framePaths,
        int startSector = 0,
        int startRow = 0
    );
    void setStl(
        const QString& filePath,
        const QColor& color,
        bool wireframe,
        double zoom
    );
    void clearImage();

    void setView(double yaw, double pitch, double fov);
    void setStlStyle(const QColor& color, bool wireframe, double zoom);
    void setSceneOverlays(
        const QJsonArray& textObjects,
        const QJsonArray& mediaObjects,
        const QVector<Hotspot>& hotspots,
        const QString& projectDirectory
    );

    Mode mode() const { return m_mode; }
    double yaw() const { return m_yaw; }
    double pitch() const { return m_pitch; }
    double fov() const { return m_fov; }

    int objectSector() const { return m_objectSector; }
    int objectRow() const { return m_objectRow; }

signals:
    void viewChanged(double yaw, double pitch, double fov);
    void hotspotRequested(double yaw, double pitch);
    void objectHotspotRequested(double xPercent, double yPercent, int sector, int row);
    void objectFrameChanged(int sector, int row);
    void imageLoadFailed(const QString& message);
    void stlLoadFailed(const QString& message);
    void hotspotSelected(int index);

protected:
    void initializeGL() override;
    void resizeGL(int width, int height) override;
    void paintGL() override;
    void paintEvent(QPaintEvent* event) override;

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
    void buildQuad();
    void uploadPendingTexture();
    void uploadPendingStl();
    void emitViewChanged();

    bool loadImage(const QString& filePath);
    void loadObjectFrame(int sector, int row);

    void renderSphere();
    void renderObject();
    void renderStl();
    void drawSceneOverlays(QPainter& painter);
    QPointF panoramaPointToScreen(double yaw, double pitch, bool* visible = nullptr) const;
    QRectF objectImageRect() const;

    QMatrix4x4 projectionMatrix() const;
    QMatrix4x4 viewMatrix() const;
    QVector3D screenRay(const QPointF& pos) const;
    QPair<double, double> rayToYawPitch(const QVector3D& ray) const;

    Mode m_mode = Mode::Empty;

    QOpenGLShaderProgram m_textureProgram;
    QOpenGLShaderProgram m_stlProgram;

    QOpenGLVertexArrayObject m_sphereVao;
    QOpenGLBuffer m_sphereVbo{QOpenGLBuffer::VertexBuffer};
    QOpenGLBuffer m_sphereIbo{QOpenGLBuffer::IndexBuffer};
    int m_sphereIndexCount = 0;

    QOpenGLVertexArrayObject m_quadVao;
    QOpenGLBuffer m_quadVbo{QOpenGLBuffer::VertexBuffer};
    QOpenGLBuffer m_quadIbo{QOpenGLBuffer::IndexBuffer};

    QOpenGLVertexArrayObject m_stlVao;
    QOpenGLBuffer m_stlVbo{QOpenGLBuffer::VertexBuffer};
    int m_stlVertexCount = 0;

    std::unique_ptr<QOpenGLTexture> m_texture;
    QImage m_pendingImage;
    bool m_hasPendingImage = false;
    int m_glMaxTextureSize = 8192;
    int m_previewMaxWidth = 8192;
    int m_previewMaxHeight = 4096;

    QVector<StlVertex> m_pendingStl;
    bool m_hasPendingStl = false;

    QString m_projection = "360";

    QVector<QVector<QString>> m_objectFrames;
    int m_objectSector = 0;
    int m_objectRow = 0;
    double m_objectDragX = 0.0;
    double m_objectDragY = 0.0;
    double m_objectAspect = 1.5;

    QColor m_stlColor{"#7c8cff"};
    bool m_stlWireframe = false;
    double m_stlZoom = 1.0;

    double m_yaw = 0.0;
    double m_pitch = 0.0;
    double m_fov = 100.0;

    QJsonArray m_textObjects;
    QJsonArray m_mediaObjects;
    QVector<Hotspot> m_hotspots;
    QString m_overlayProjectDirectory;
    QHash<QString, QImage> m_overlayImages;

    bool m_dragging = false;
    QPoint m_lastMouse;
};
