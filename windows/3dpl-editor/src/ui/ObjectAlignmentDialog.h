#pragma once

#include "model/Scene.h"

#include <QDialog>
#include <QImage>

class QGraphicsScene;
class QGraphicsView;
class QGraphicsPixmapItem;
class QSpinBox;
class QDoubleSpinBox;
class QSlider;
class QLabel;

class ObjectAlignmentDialog final : public QDialog {
    Q_OBJECT
public:
    ObjectAlignmentDialog(
        Scene scene,
        const QString& projectDirectory,
        QWidget* parent = nullptr
    );

    Scene resultScene() const { return m_scene; }

private:
    void buildUi();
    void syncRanges();
    void reloadImages();
    void refreshPreview();
    void resetTransform();
    void applyCurrentFrame();
    void normalizeAllFrames();

    QString absoluteFramePath(int row, int sector) const;
    QString relativeAlignedPath(int row, int sector) const;
    bool writeAlignedFrame(
        int row,
        int sector,
        const QImage& source,
        const QSize& canvas,
        double dx,
        double dy,
        double scale,
        double rotation,
        QString* error
    );

    Scene m_scene;
    QString m_projectDirectory;

    QGraphicsScene* m_graphicsScene = nullptr;
    QGraphicsView* m_view = nullptr;
    QGraphicsPixmapItem* m_referenceItem = nullptr;
    QGraphicsPixmapItem* m_currentItem = nullptr;

    QSpinBox* m_row = nullptr;
    QSpinBox* m_sector = nullptr;
    QSpinBox* m_referenceSector = nullptr;
    QSpinBox* m_dx = nullptr;
    QSpinBox* m_dy = nullptr;
    QDoubleSpinBox* m_scale = nullptr;
    QDoubleSpinBox* m_rotation = nullptr;
    QSlider* m_opacity = nullptr;
    QLabel* m_info = nullptr;

    QImage m_referenceImage;
    QImage m_currentImage;
};
