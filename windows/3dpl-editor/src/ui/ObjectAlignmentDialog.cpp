#include "ObjectAlignmentDialog.h"

#include <QDialogButtonBox>
#include <QDir>
#include <QFileInfo>
#include <QFormLayout>
#include <QGraphicsPixmapItem>
#include <QGraphicsScene>
#include <QGraphicsView>
#include <QHBoxLayout>
#include <QImageReader>
#include <QLabel>
#include <QMessageBox>
#include <QPainter>
#include <QPushButton>
#include <QSlider>
#include <QSpinBox>
#include <QDoubleSpinBox>
#include <QTransform>
#include <QVBoxLayout>

#include <algorithm>

namespace {

QImage readPreview(const QString& path) {
    QImageReader reader(path);
    reader.setAutoTransform(true);
    const QSize original = reader.size();
    if (original.isValid() && (original.width() > 2200 || original.height() > 1600))
        reader.setScaledSize(original.scaled(2200, 1600, Qt::KeepAspectRatio));
    return reader.read().convertToFormat(QImage::Format_ARGB32_Premultiplied);
}

QImage readFull(const QString& path) {
    QImageReader reader(path);
    reader.setAutoTransform(true);
    return reader.read().convertToFormat(QImage::Format_ARGB32_Premultiplied);
}

}

ObjectAlignmentDialog::ObjectAlignmentDialog(
    Scene scene,
    const QString& projectDirectory,
    QWidget* parent
)
    : QDialog(parent)
    , m_scene(std::move(scene))
    , m_projectDirectory(projectDirectory)
{
    setWindowTitle(QString::fromUtf8("Object360 — ручное выравнивание"));
    resize(1250, 800);
    buildUi();
    syncRanges();
    reloadImages();
}

void ObjectAlignmentDialog::buildUi() {
    auto* root = new QHBoxLayout(this);

    auto* controls = new QWidget(this);
    controls->setMinimumWidth(280);
    controls->setMaximumWidth(360);
    auto* left = new QVBoxLayout(controls);

    auto* title = new QLabel(
        QString::fromUtf8(
            "Выравнивание кадра\n"
            "Эталон показан непрозрачно, текущий кадр — поверх него."
        ),
        controls
    );
    title->setWordWrap(true);
    left->addWidget(title);

    auto* form = new QFormLayout;
    m_row = new QSpinBox(controls);
    m_sector = new QSpinBox(controls);
    m_referenceSector = new QSpinBox(controls);

    m_dx = new QSpinBox(controls);
    m_dx->setRange(-4000, 4000);
    m_dx->setSuffix(" px");

    m_dy = new QSpinBox(controls);
    m_dy->setRange(-4000, 4000);
    m_dy->setSuffix(" px");

    m_scale = new QDoubleSpinBox(controls);
    m_scale->setRange(20.0, 300.0);
    m_scale->setValue(100.0);
    m_scale->setDecimals(2);
    m_scale->setSuffix("%");

    m_rotation = new QDoubleSpinBox(controls);
    m_rotation->setRange(-180.0, 180.0);
    m_rotation->setDecimals(2);
    m_rotation->setSingleStep(0.25);
    m_rotation->setSuffix(QString::fromUtf8("°"));

    m_opacity = new QSlider(Qt::Horizontal, controls);
    m_opacity->setRange(0, 100);
    m_opacity->setValue(55);

    form->addRow(QString::fromUtf8("Ряд"), m_row);
    form->addRow(QString::fromUtf8("Сектор"), m_sector);
    form->addRow(QString::fromUtf8("Эталон"), m_referenceSector);
    form->addRow("X", m_dx);
    form->addRow("Y", m_dy);
    form->addRow(QString::fromUtf8("Масштаб"), m_scale);
    form->addRow(QString::fromUtf8("Поворот"), m_rotation);
    form->addRow(QString::fromUtf8("Прозрачность"), m_opacity);
    left->addLayout(form);

    auto* reset = new QPushButton(QString::fromUtf8("Сбросить преобразование"), controls);
    auto* apply = new QPushButton(QString::fromUtf8("Запечь текущий кадр"), controls);
    auto* normalize = new QPushButton(QString::fromUtf8("Привести ВСЕ кадры к одному размеру"), controls);
    left->addWidget(reset);
    left->addWidget(apply);
    left->addWidget(normalize);

    m_info = new QLabel(controls);
    m_info->setWordWrap(true);
    m_info->setStyleSheet("color:#88a0c5;padding-top:8px;");
    left->addWidget(m_info);
    left->addStretch();

    auto* buttons = new QDialogButtonBox(
        QDialogButtonBox::Ok | QDialogButtonBox::Cancel,
        controls
    );
    left->addWidget(buttons);

    root->addWidget(controls);

    m_graphicsScene = new QGraphicsScene(this);
    m_view = new QGraphicsView(m_graphicsScene, this);
    m_view->setRenderHints(
        QPainter::Antialiasing |
        QPainter::SmoothPixmapTransform
    );
    m_view->setDragMode(QGraphicsView::ScrollHandDrag);
    m_view->setBackgroundBrush(QColor("#111722"));
    root->addWidget(m_view, 1);

    m_referenceItem = m_graphicsScene->addPixmap(QPixmap());
    m_currentItem = m_graphicsScene->addPixmap(QPixmap());

    auto refresh = [this] { refreshPreview(); };
    connect(m_row, qOverload<int>(&QSpinBox::valueChanged), this, [this] {
        syncRanges();
        reloadImages();
    });
    connect(m_sector, qOverload<int>(&QSpinBox::valueChanged), this, [this] {
        if (m_referenceSector->value() == m_sector->value()) {
            const int count = m_scene.frames.value(m_row->value()).size();
            if (count > 1)
                m_referenceSector->setValue((m_sector->value() + count - 1) % count);
        }
        reloadImages();
    });
    connect(m_referenceSector, qOverload<int>(&QSpinBox::valueChanged), this, [this] {
        reloadImages();
    });
    connect(m_dx, qOverload<int>(&QSpinBox::valueChanged), this, refresh);
    connect(m_dy, qOverload<int>(&QSpinBox::valueChanged), this, refresh);
    connect(m_scale, qOverload<double>(&QDoubleSpinBox::valueChanged), this, refresh);
    connect(m_rotation, qOverload<double>(&QDoubleSpinBox::valueChanged), this, refresh);
    connect(m_opacity, &QSlider::valueChanged, this, refresh);

    connect(reset, &QPushButton::clicked, this, &ObjectAlignmentDialog::resetTransform);
    connect(apply, &QPushButton::clicked, this, &ObjectAlignmentDialog::applyCurrentFrame);
    connect(normalize, &QPushButton::clicked, this, &ObjectAlignmentDialog::normalizeAllFrames);
    connect(buttons, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(buttons, &QDialogButtonBox::rejected, this, &QDialog::reject);
}

void ObjectAlignmentDialog::syncRanges() {
    const int rowCount = m_scene.frames.size();
    m_row->setRange(0, std::max(0, rowCount - 1));
    if (rowCount <= 0) {
        m_sector->setRange(0, 0);
        m_referenceSector->setRange(0, 0);
        return;
    }

    const int sectors = m_scene.frames.value(m_row->value()).size();
    m_sector->setRange(0, std::max(0, sectors - 1));
    m_referenceSector->setRange(0, std::max(0, sectors - 1));
    if (sectors > 1 && m_referenceSector->value() == m_sector->value())
        m_referenceSector->setValue((m_sector->value() + sectors - 1) % sectors);
}

QString ObjectAlignmentDialog::absoluteFramePath(int row, int sector) const {
    if (row < 0 || row >= m_scene.frames.size()) return {};
    const auto& r = m_scene.frames.at(row);
    if (sector < 0 || sector >= r.size()) return {};
    const QString relative = r.at(sector);
    if (relative.isEmpty()) return {};
    return QDir(m_projectDirectory).filePath(relative);
}

QString ObjectAlignmentDialog::relativeAlignedPath(int row, int sector) const {
    const QString dir = QString("assets/object360/%1/aligned").arg(m_scene.id);
    return QString("%1/r%2_s%3.png")
        .arg(dir)
        .arg(row, 2, 10, QLatin1Char('0'))
        .arg(sector, 3, 10, QLatin1Char('0'));
}

void ObjectAlignmentDialog::reloadImages() {
    m_currentImage = readPreview(absoluteFramePath(m_row->value(), m_sector->value()));
    m_referenceImage = readPreview(
        absoluteFramePath(m_row->value(), m_referenceSector->value())
    );
    refreshPreview();
}

void ObjectAlignmentDialog::refreshPreview() {
    m_referenceItem->setPixmap(QPixmap::fromImage(m_referenceImage));
    m_referenceItem->setOpacity(1.0);
    m_referenceItem->setPos(0, 0);
    m_referenceItem->setTransform(QTransform());

    m_currentItem->setPixmap(QPixmap::fromImage(m_currentImage));
    m_currentItem->setOpacity(m_opacity->value() / 100.0);

    if (!m_currentImage.isNull()) {
        const QPointF sourceCenter(
            m_currentImage.width() / 2.0,
            m_currentImage.height() / 2.0
        );
        const QSize referenceSize = !m_referenceImage.isNull()
            ? m_referenceImage.size()
            : m_currentImage.size();
        const QPointF canvasCenter(
            referenceSize.width() / 2.0,
            referenceSize.height() / 2.0
        );
        QTransform t;
        t.translate(canvasCenter.x() + m_dx->value(), canvasCenter.y() + m_dy->value());
        t.rotate(m_rotation->value());
        const double scale = m_scale->value() / 100.0;
        t.scale(scale, scale);
        t.translate(-sourceCenter.x(), -sourceCenter.y());
        m_currentItem->setTransform(t);
    }

    QRectF bounds = m_graphicsScene->itemsBoundingRect();
    if (bounds.isEmpty()) bounds = QRectF(0, 0, 1000, 700);
    m_graphicsScene->setSceneRect(bounds.adjusted(-100, -100, 100, 100));
    m_view->fitInView(bounds, Qt::KeepAspectRatio);

    m_info->setText(
        QString::fromUtf8("Кадр: %1×%2\nЭталон: %3×%4")
            .arg(m_currentImage.width())
            .arg(m_currentImage.height())
            .arg(m_referenceImage.width())
            .arg(m_referenceImage.height())
    );
}

void ObjectAlignmentDialog::resetTransform() {
    m_dx->setValue(0);
    m_dy->setValue(0);
    m_scale->setValue(100.0);
    m_rotation->setValue(0.0);
}

bool ObjectAlignmentDialog::writeAlignedFrame(
    int row,
    int sector,
    const QImage& source,
    const QSize& canvas,
    double dx,
    double dy,
    double scale,
    double rotation,
    QString* error
) {
    if (source.isNull() || canvas.isEmpty()) {
        if (error) *error = QString::fromUtf8("Пустой кадр");
        return false;
    }

    QImage output(canvas, QImage::Format_ARGB32);
    output.fill(Qt::transparent);

    QPainter painter(&output);
    painter.setRenderHint(QPainter::Antialiasing, true);
    painter.setRenderHint(QPainter::SmoothPixmapTransform, true);

    const QPointF canvasCenter(canvas.width() / 2.0, canvas.height() / 2.0);
    const QPointF sourceCenter(source.width() / 2.0, source.height() / 2.0);

    painter.translate(canvasCenter.x() + dx, canvasCenter.y() + dy);
    painter.rotate(rotation);
    painter.scale(scale, scale);
    painter.translate(-sourceCenter.x(), -sourceCenter.y());
    painter.drawImage(QPointF(0, 0), source);
    painter.end();

    QString relative = relativeAlignedPath(row, sector);
    relative.replace('\\', '/');
    const QString absolute = QDir(m_projectDirectory).filePath(relative);
    QDir().mkpath(QFileInfo(absolute).absolutePath());

    if (!output.save(absolute, "PNG")) {
        if (error) *error = QString::fromUtf8("Не удалось сохранить выровненный кадр");
        return false;
    }

    m_scene.frames[row][sector] = relative;
    return true;
}

void ObjectAlignmentDialog::applyCurrentFrame() {
    const int row = m_row->value();
    const int sector = m_sector->value();
    if (m_currentImage.isNull()) return;

    QSize canvas = !m_referenceImage.isNull()
        ? m_referenceImage.size()
        : m_currentImage.size();

    QString error;
    if (!writeAlignedFrame(
            row,
            sector,
            readFull(absoluteFramePath(row, sector)),
            canvas,
            m_dx->value(),
            m_dy->value(),
            m_scale->value() / 100.0,
            m_rotation->value(),
            &error
        )) {
        QMessageBox::critical(this, QString::fromUtf8("Выравнивание"), error);
        return;
    }

    resetTransform();
    reloadImages();
    QMessageBox::information(
        this,
        QString::fromUtf8("Выравнивание"),
        QString::fromUtf8("Кадр сохранён как новая выровненная копия.")
    );
}

void ObjectAlignmentDialog::normalizeAllFrames() {
    if (m_scene.frames.isEmpty()) return;

    QSize target;
    for (const auto& row : m_scene.frames) {
        for (const QString& relative : row) {
            QImageReader reader(QDir(m_projectDirectory).filePath(relative));
            const QSize size = reader.size();
            if (size.isValid()) {
                target.setWidth(std::max(target.width(), size.width()));
                target.setHeight(std::max(target.height(), size.height()));
            }
        }
    }
    if (target.isEmpty()) return;

    if (QMessageBox::question(
            this,
            QString::fromUtf8("Нормализация"),
            QString::fromUtf8(
                "Привести все кадры к холсту %1×%2 без растяжения?\n"
                "Кадры будут центрированы, исходники останутся на диске."
            ).arg(target.width()).arg(target.height())
        ) != QMessageBox::Yes) {
        return;
    }

    int saved = 0;
    for (int row = 0; row < m_scene.frames.size(); ++row) {
        for (int sector = 0; sector < m_scene.frames[row].size(); ++sector) {
            const QImage source = readFull(absoluteFramePath(row, sector));
            if (source.isNull()) continue;
            QString error;
            if (writeAlignedFrame(
                    row,
                    sector,
                    source,
                    target,
                    0,
                    0,
                    1.0,
                    0.0,
                    &error
                )) {
                ++saved;
            }
        }
    }

    reloadImages();
    QMessageBox::information(
        this,
        QString::fromUtf8("Нормализация"),
        QString::fromUtf8("Готово. Обработано кадров: %1").arg(saved)
    );
}
