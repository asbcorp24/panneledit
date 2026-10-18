#include "SceneInspector.h"

#include <algorithm>
#include <QComboBox>
#include <QDoubleSpinBox>
#include <QFormLayout>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QJsonArray>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QPushButton>
#include <QSignalBlocker>
#include <QTextEdit>
#include <QVBoxLayout>

SceneInspector::SceneInspector(QWidget* parent)
    : QWidget(parent) {
    buildUi();
    clearScene();
}

void SceneInspector::buildUi() {
    auto* root = new QVBoxLayout(this);
    root->setContentsMargins(8, 8, 8, 8);
    root->setSpacing(8);

    auto* sceneGroup = new QGroupBox(QString::fromUtf8("Сцена"), this);
    auto* sceneForm = new QFormLayout(sceneGroup);

    m_typeLabel = new QLabel(sceneGroup);
    m_title = new QLineEdit(sceneGroup);

    auto makeAngle = [&](double min, double max, double value) {
        auto* spin = new QDoubleSpinBox(sceneGroup);
        spin->setRange(min, max);
        spin->setDecimals(2);
        spin->setSingleStep(1.0);
        spin->setValue(value);
        return spin;
    };

    m_yaw = makeAngle(-180, 180, 0);
    m_pitch = makeAngle(-89, 89, 0);
    m_fov = makeAngle(30, 120, 100);

    sceneForm->addRow(QString::fromUtf8("Тип"), m_typeLabel);
    sceneForm->addRow(QString::fromUtf8("Название"), m_title);
    sceneForm->addRow("Yaw", m_yaw);
    sceneForm->addRow("Pitch", m_pitch);
    sceneForm->addRow("FOV", m_fov);
    root->addWidget(sceneGroup);

    auto* hotspotGroup = new QGroupBox(QString::fromUtf8("Hotspots"), this);
    auto* hotspotLayout = new QVBoxLayout(hotspotGroup);
    m_hotspots = new QListWidget(hotspotGroup);
    m_hotspots->setMinimumHeight(120);
    hotspotLayout->addWidget(m_hotspots);

    auto* hotspotForm = new QFormLayout();
    m_hotspotType = new QComboBox(hotspotGroup);
    m_hotspotType->addItem(QString::fromUtf8("Переход"), "scene");
    m_hotspotType->addItem(QString::fromUtf8("Информация"), "info");
    m_hotspotType->addItem(QString::fromUtf8("Ссылка"), "url");

    m_hotspotText = new QLineEdit(hotspotGroup);
    m_hotspotYaw = makeAngle(-180, 180, 0);
    m_hotspotPitch = makeAngle(-89, 89, 0);
    m_targetScene = new QComboBox(hotspotGroup);
    m_url = new QLineEdit(hotspotGroup);
    m_info = new QTextEdit(hotspotGroup);
    m_info->setMaximumHeight(80);

    hotspotForm->addRow(QString::fromUtf8("Действие"), m_hotspotType);
    hotspotForm->addRow(QString::fromUtf8("Подпись"), m_hotspotText);
    hotspotForm->addRow("Yaw", m_hotspotYaw);
    hotspotForm->addRow("Pitch", m_hotspotPitch);
    hotspotForm->addRow(QString::fromUtf8("Сцена"), m_targetScene);
    hotspotForm->addRow("URL", m_url);
    hotspotForm->addRow(QString::fromUtf8("Текст"), m_info);
    hotspotLayout->addLayout(hotspotForm);

    m_deleteHotspot = new QPushButton(QString::fromUtf8("Удалить hotspot"), hotspotGroup);
    hotspotLayout->addWidget(m_deleteHotspot);
    root->addWidget(hotspotGroup, 1);

    auto sceneCommit = [this] {
        if (!m_updating) commitScene();
    };
    connect(m_title, &QLineEdit::editingFinished, this, sceneCommit);
    connect(m_yaw, &QDoubleSpinBox::valueChanged, this, [sceneCommit](double){ sceneCommit(); });
    connect(m_pitch, &QDoubleSpinBox::valueChanged, this, [sceneCommit](double){ sceneCommit(); });
    connect(m_fov, &QDoubleSpinBox::valueChanged, this, [sceneCommit](double){ sceneCommit(); });

    connect(m_hotspots, &QListWidget::currentRowChanged, this, [this](int row) {
        if (m_updating) return;
        loadHotspot(row);
        emit hotspotSelectionChanged(row);
    });

    auto hotspotCommit = [this] {
        if (!m_updating) commitHotspot();
    };
    connect(m_hotspotType, &QComboBox::currentIndexChanged, this, [hotspotCommit](int){ hotspotCommit(); });
    connect(m_hotspotText, &QLineEdit::editingFinished, this, hotspotCommit);
    connect(m_hotspotYaw, &QDoubleSpinBox::valueChanged, this, [hotspotCommit](double){ hotspotCommit(); });
    connect(m_hotspotPitch, &QDoubleSpinBox::valueChanged, this, [hotspotCommit](double){ hotspotCommit(); });
    connect(m_targetScene, &QComboBox::currentIndexChanged, this, [hotspotCommit](int){ hotspotCommit(); });
    connect(m_url, &QLineEdit::editingFinished, this, hotspotCommit);
    connect(m_info, &QTextEdit::textChanged, this, hotspotCommit);

    connect(m_deleteHotspot, &QPushButton::clicked, this, [this] {
        if (m_sceneIndex >= 0 && m_hotspotIndex >= 0)
            emit deleteHotspotRequested(m_sceneIndex, m_hotspotIndex);
    });
}

void SceneInspector::setScene(const QJsonObject& scene, int sceneIndex) {
    setUpdating(true);
    m_scene = scene;
    m_sceneIndex = sceneIndex;
    m_hotspotIndex = -1;

    const QString type = scene.value("sceneType").toString("panorama");
    m_typeLabel->setText(type);
    m_title->setText(scene.value("title").toString());
    m_yaw->setValue(scene.value("yaw").toDouble());
    m_pitch->setValue(scene.value("pitch").toDouble());

    const double fov = scene.contains("hfov")
        ? scene.value("hfov").toDouble(100.0)
        : scene.value("xr").toObject().value("fov").toDouble(80.0);
    m_fov->setValue(fov);

    refreshHotspots();
    setUpdating(false);

    if (m_hotspots->count() > 0)
        m_hotspots->setCurrentRow(0);
    else
        loadHotspot(-1);
}

void SceneInspector::clearScene() {
    setUpdating(true);
    m_scene = {};
    m_sceneIndex = -1;
    m_hotspotIndex = -1;
    m_typeLabel->setText("-");
    m_title->clear();
    m_yaw->setValue(0);
    m_pitch->setValue(0);
    m_fov->setValue(100);
    m_hotspots->clear();
    loadHotspot(-1);
    setUpdating(false);
    setEnabled(false);
}

void SceneInspector::refreshHotspots() {
    setEnabled(m_sceneIndex >= 0);
    m_hotspots->clear();

    const QJsonArray hotspots = m_scene.value("hotspots").toArray();
    for (int i = 0; i < hotspots.size(); ++i) {
        const QJsonObject h = hotspots.at(i).toObject();
        QString label = h.value("text").toString();
        if (label.isEmpty())
            label = h.value("type").toString(QStringLiteral("hotspot"));
        m_hotspots->addItem(QString::number(i + 1) + ". " + label);
    }
}

void SceneInspector::selectHotspot(int index) {
    if (index < 0 || index >= m_hotspots->count())
        return;
    m_hotspots->setCurrentRow(index);
}

void SceneInspector::loadHotspot(int index) {
    setUpdating(true);
    m_hotspotIndex = index;
    const QJsonArray hotspots = m_scene.value("hotspots").toArray();
    const bool valid = index >= 0 && index < hotspots.size();

    for (QWidget* w : {static_cast<QWidget*>(m_hotspotType), m_hotspotText, m_hotspotYaw,
                       m_hotspotPitch, m_targetScene, m_url, m_info, m_deleteHotspot})
        w->setEnabled(valid);

    if (!valid) {
        m_hotspotText->clear();
        m_url->clear();
        m_info->clear();
        setUpdating(false);
        return;
    }

    const QJsonObject h = hotspots.at(index).toObject();
    const int typeIndex = m_hotspotType->findData(h.value("type").toString("info"));
    m_hotspotType->setCurrentIndex(std::max(0, typeIndex));
    m_hotspotText->setText(h.value("text").toString());
    m_hotspotYaw->setValue(h.value("yaw").toDouble());
    m_hotspotPitch->setValue(h.value("pitch").toDouble());
    m_url->setText(h.value("url").toString());
    m_info->setPlainText(h.value("info").toString());

    setUpdating(false);
}

void SceneInspector::commitScene() {
    if (m_sceneIndex < 0)
        return;

    m_scene.insert("title", m_title->text().trimmed());
    m_scene.insert("yaw", m_yaw->value());
    m_scene.insert("pitch", m_pitch->value());

    if (m_scene.value("sceneType").toString() == "xr") {
        QJsonObject xr = m_scene.value("xr").toObject();
        xr.insert("fov", m_fov->value());
        m_scene.insert("xr", xr);
    } else {
        m_scene.insert("hfov", m_fov->value());
    }

    emit sceneChanged(m_sceneIndex, m_scene);
}

void SceneInspector::commitHotspot() {
    if (m_sceneIndex < 0 || m_hotspotIndex < 0)
        return;

    QJsonArray hotspots = m_scene.value("hotspots").toArray();
    if (m_hotspotIndex >= hotspots.size())
        return;

    QJsonObject h = hotspots.at(m_hotspotIndex).toObject();
    h.insert("type", m_hotspotType->currentData().toString());
    h.insert("text", m_hotspotText->text());
    h.insert("yaw", m_hotspotYaw->value());
    h.insert("pitch", m_hotspotPitch->value());
    h.insert("targetSceneId", m_targetScene->currentData().toString());
    h.insert("url", m_url->text());
    h.insert("info", m_info->toPlainText());
    h.insert("anchorYaw", m_hotspotYaw->value());
    h.insert("anchorPitch", m_hotspotPitch->value());

    hotspots.replace(m_hotspotIndex, h);
    m_scene.insert("hotspots", hotspots);
    emit sceneChanged(m_sceneIndex, m_scene);
}
