#include "ProjectOptionsDialog.h"

#include "io/ProjectStorage.h"

#include <QCheckBox>
#include <QComboBox>
#include <QDialogButtonBox>
#include <QFileDialog>
#include <QFileInfo>
#include <QFormLayout>
#include <QGroupBox>
#include <QHeaderView>
#include <QHBoxLayout>
#include <QInputDialog>
#include <QJsonArray>
#include <QJsonObject>
#include <QLabel>
#include <QLineEdit>
#include <QMessageBox>
#include <QPushButton>
#include <QSpinBox>
#include <QTableWidget>
#include <QVBoxLayout>
#include <QUuid>

ProjectOptionsDialog::ProjectOptionsDialog(
    Project project,
    const QString& projectDirectory,
    QWidget* parent
)
    : QDialog(parent)
    , m_project(std::move(project))
    , m_projectDirectory(projectDirectory)
{
    setWindowTitle(QString::fromUtf8("Настройки тура"));
    resize(820, 760);
    buildUi();
    loadFromProject();
}

void ProjectOptionsDialog::buildUi() {
    auto* root = new QVBoxLayout(this);

    auto* startGroup = new QGroupBox(QString::fromUtf8("Стартовый экран"));
    auto* startForm = new QFormLayout(startGroup);
    m_startEnabled = new QCheckBox(QString::fromUtf8("Показывать стартовый экран"));
    m_startTitle = new QLineEdit;
    m_startSubtitle = new QLineEdit;
    m_coverLabel = new QLabel(QString::fromUtf8("Не выбран"));
    m_coverLabel->setWordWrap(true);
    m_allowSilent = new QCheckBox(QString::fromUtf8("Разрешить вход без звука"));

    auto* coverRow = new QWidget;
    auto* coverLayout = new QHBoxLayout(coverRow);
    coverLayout->setContentsMargins(0,0,0,0);
    auto* chooseCover = new QPushButton(QString::fromUtf8("Выбрать…"));
    auto* clearCover = new QPushButton(QString::fromUtf8("Убрать"));
    coverLayout->addWidget(m_coverLabel,1);
    coverLayout->addWidget(chooseCover);
    coverLayout->addWidget(clearCover);

    startForm->addRow("", m_startEnabled);
    startForm->addRow(QString::fromUtf8("Заголовок"), m_startTitle);
    startForm->addRow(QString::fromUtf8("Подзаголовок"), m_startSubtitle);
    startForm->addRow(QString::fromUtf8("Обложка"), coverRow);
    startForm->addRow("", m_allowSilent);
    root->addWidget(startGroup);

    connect(chooseCover, &QPushButton::clicked, this, &ProjectOptionsDialog::chooseCover);
    connect(clearCover, &QPushButton::clicked, this, [this] {
        m_coverSource.clear();
        m_coverLabel->setText(QString::fromUtf8("Не выбран"));
    });

    auto* guideGroup = new QGroupBox(QString::fromUtf8("Экскурсия с гидом"));
    auto* guideLayout = new QVBoxLayout(guideGroup);
    m_guideEnabled = new QCheckBox(QString::fromUtf8("Включить режим гида"));
    guideLayout->addWidget(m_guideEnabled);

    m_guideTable = new QTableWidget(0,4);
    m_guideTable->setHorizontalHeaderLabels({
        QString::fromUtf8("Сцена"),
        QString::fromUtf8("Сек."),
        QString::fromUtf8("Озвучка"),
        QString::fromUtf8("Hotspot")
    });
    m_guideTable->horizontalHeader()->setSectionResizeMode(0,QHeaderView::Stretch);
    m_guideTable->horizontalHeader()->setSectionResizeMode(3,QHeaderView::Stretch);
    m_guideTable->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_guideTable->setEditTriggers(QAbstractItemView::NoEditTriggers);
    guideLayout->addWidget(m_guideTable);

    auto* guideButtons = new QHBoxLayout;
    auto* addGuide = new QPushButton(QString::fromUtf8("Добавить"));
    auto* editGuide = new QPushButton(QString::fromUtf8("Изменить"));
    auto* removeGuide = new QPushButton(QString::fromUtf8("Удалить"));
    guideButtons->addWidget(addGuide);
    guideButtons->addWidget(editGuide);
    guideButtons->addWidget(removeGuide);
    guideButtons->addStretch();
    guideLayout->addLayout(guideButtons);
    root->addWidget(guideGroup,1);

    connect(addGuide, &QPushButton::clicked, this, &ProjectOptionsDialog::addGuideStep);
    connect(editGuide, &QPushButton::clicked, this, &ProjectOptionsDialog::editGuideStep);
    connect(removeGuide, &QPushButton::clicked, this, &ProjectOptionsDialog::removeGuideStep);
    connect(m_guideTable, &QTableWidget::cellDoubleClicked, this, [this](int, int){ editGuideStep(); });

    auto* behaviorGroup = new QGroupBox(QString::fromUtf8("Поведение тура"));
    auto* behaviorForm = new QFormLayout(behaviorGroup);
    m_fadeEnabled = new QCheckBox(QString::fromUtf8("Плавный переход"));
    m_fadeDuration = new QSpinBox;
    m_fadeDuration->setRange(0,10000);
    m_fadeDuration->setSuffix(" ms");
    m_defaultTransition = new QComboBox;
    m_defaultTransition->addItems({"fade","zoom","blur","portal","glitch","black"});
    m_autoRotateEnabled = new QCheckBox(QString::fromUtf8("Автовращение"));
    m_autoRotate = new QSpinBox;
    m_autoRotate->setRange(-20,20);
    behaviorForm->addRow("",m_fadeEnabled);
    behaviorForm->addRow(QString::fromUtf8("Длительность"),m_fadeDuration);
    behaviorForm->addRow(QString::fromUtf8("Переход"),m_defaultTransition);
    behaviorForm->addRow("",m_autoRotateEnabled);
    behaviorForm->addRow(QString::fromUtf8("Скорость"),m_autoRotate);
    root->addWidget(behaviorGroup);

    auto* exportGroup = new QGroupBox(QString::fromUtf8("Экспорт"));
    auto* exportForm = new QFormLayout(exportGroup);
    m_optimizeEnabled = new QCheckBox(QString::fromUtf8("Оптимизировать"));
    m_jpegQuality = new QSpinBox;
    m_jpegQuality->setRange(45,100);
    m_jpegQuality->setSuffix("%");
    m_maxImageWidth = new QSpinBox;
    m_maxImageWidth->setRange(1024,16384);
    m_maxImageWidth->setSingleStep(512);
    m_objectFrameWidth = new QSpinBox;
    m_objectFrameWidth->setRange(480,4096);
    m_objectFrameWidth->setSingleStep(160);
    m_pwaEnabled = new QCheckBox("PWA");
    m_kioskMode = new QCheckBox("Kiosk mode");
    m_publicUrl = new QLineEdit;
    exportForm->addRow("",m_optimizeEnabled);
    exportForm->addRow("JPEG",m_jpegQuality);
    exportForm->addRow(QString::fromUtf8("Макс. панорама"),m_maxImageWidth);
    exportForm->addRow(QString::fromUtf8("Object360 кадр"),m_objectFrameWidth);
    exportForm->addRow("",m_pwaEnabled);
    exportForm->addRow("",m_kioskMode);
    exportForm->addRow("Public URL",m_publicUrl);
    root->addWidget(exportGroup);

    auto* buttons = new QDialogButtonBox(QDialogButtonBox::Ok|QDialogButtonBox::Cancel);
    root->addWidget(buttons);
    connect(buttons,&QDialogButtonBox::accepted,this,[this]{ saveToProject(); accept(); });
    connect(buttons,&QDialogButtonBox::rejected,this,&QDialog::reject);
}

void ProjectOptionsDialog::loadFromProject() {
    const QJsonObject start = m_project.startScreen;
    m_startEnabled->setChecked(start.value("enabled").toBool(true));
    m_startTitle->setText(start.value("title").toString(m_project.title));
    m_startSubtitle->setText(start.value("subtitle").toString());
    m_coverSource = start.value("coverData").toString(start.value("coverSource").toString());
    m_coverLabel->setText(m_coverSource.isEmpty() ? QString::fromUtf8("Не выбран") : m_coverSource);
    m_allowSilent->setChecked(start.value("allowSilent").toBool(true));

    m_guideEnabled->setChecked(m_project.guide.value("enabled").toBool(false));

    m_fadeEnabled->setChecked(m_project.fadeEnabled);
    m_fadeDuration->setValue(m_project.fadeDurationMs);
    m_defaultTransition->setCurrentText(m_project.defaultTransition);
    m_autoRotateEnabled->setChecked(m_project.autoRotateEnabled);
    m_autoRotate->setValue(int(m_project.autoRotate));

    const QJsonObject e = m_project.exportSettings;
    m_optimizeEnabled->setChecked(e.value("optimizeEnabled").toBool(true));
    m_jpegQuality->setValue(e.value("jpegQuality").toInt(84));
    m_maxImageWidth->setValue(e.value("maxImageWidth").toInt(4096));
    m_objectFrameWidth->setValue(e.value("objectFrameWidth").toInt(1280));
    m_pwaEnabled->setChecked(e.value("pwaEnabled").toBool(true));
    m_kioskMode->setChecked(e.value("kioskMode").toBool(false));
    m_publicUrl->setText(e.value("publicUrl").toString());

    refreshGuideTable();
}

void ProjectOptionsDialog::saveToProject() {
    m_project.startScreen = QJsonObject{
        {"enabled",m_startEnabled->isChecked()},
        {"title",m_startTitle->text()},
        {"subtitle",m_startSubtitle->text()},
        {"coverData",m_coverSource},
        {"coverFilename",QFileInfo(m_coverSource).fileName()},
        {"allowSilent",m_allowSilent->isChecked()}
    };

    QJsonObject guide = m_project.guide;
    guide.insert("enabled",m_guideEnabled->isChecked());
    m_project.guide = guide;

    m_project.fadeEnabled = m_fadeEnabled->isChecked();
    m_project.fadeDurationMs = m_fadeDuration->value();
    m_project.defaultTransition = m_defaultTransition->currentText();
    m_project.autoRotateEnabled = m_autoRotateEnabled->isChecked();
    m_project.autoRotate = m_autoRotate->value();

    m_project.exportSettings = QJsonObject{
        {"optimizeEnabled",m_optimizeEnabled->isChecked()},
        {"jpegQuality",m_jpegQuality->value()},
        {"maxImageWidth",m_maxImageWidth->value()},
        {"objectFrameWidth",m_objectFrameWidth->value()},
        {"pwaEnabled",m_pwaEnabled->isChecked()},
        {"kioskMode",m_kioskMode->isChecked()},
        {"publicUrl",m_publicUrl->text().trimmed()}
    };
}

void ProjectOptionsDialog::chooseCover() {
    const QString file = QFileDialog::getOpenFileName(
        this,QString::fromUtf8("Обложка"),
        QString(),
        QString::fromUtf8("Изображения (*.jpg *.jpeg *.png *.webp)")
    );
    if(file.isEmpty()) return;
    QString error;
    const QString rel = ProjectStorage::importAsset(m_projectDirectory,file,"media",&error);
    if(rel.isEmpty()){
        QMessageBox::critical(this,QString::fromUtf8("Обложка"),error);
        return;
    }
    m_coverSource=rel;
    m_coverLabel->setText(rel);
}

void ProjectOptionsDialog::refreshGuideTable() {
    m_guideTable->setRowCount(0);
    const QJsonArray steps = m_project.guide.value("steps").toArray();
    for(int i=0;i<steps.size();++i){
        const QJsonObject step=steps.at(i).toObject();
        const int row=m_guideTable->rowCount();
        m_guideTable->insertRow(row);
        QString sceneTitle=step.value("sceneId").toString();
        if(const Scene* scene=m_project.findScene(sceneTitle)) sceneTitle=scene->title;
        m_guideTable->setItem(row,0,new QTableWidgetItem(sceneTitle));
        m_guideTable->setItem(row,1,new QTableWidgetItem(QString::number(step.value("duration").toInt(12))));
        m_guideTable->setItem(row,2,new QTableWidgetItem(step.value("narrationAuto").toBool()?QString::fromUtf8("Да"):QString::fromUtf8("Нет")));
        m_guideTable->setItem(row,3,new QTableWidgetItem(step.value("highlightHotspotId").toString()));
    }
}

void ProjectOptionsDialog::addGuideStep() {
    if(m_project.scenes.isEmpty()){
        QMessageBox::information(this,QString::fromUtf8("Гид"),QString::fromUtf8("Сначала добавьте сцену."));
        return;
    }

    QDialog dialog(this);
    dialog.setWindowTitle(QString::fromUtf8("Шаг гида"));
    auto* layout=new QFormLayout(&dialog);
    auto* sceneBox=new QComboBox;
    for(const auto& scene:m_project.scenes) sceneBox->addItem(scene.title,scene.id);
    auto* duration=new QSpinBox;
    duration->setRange(2,600); duration->setValue(12); duration->setSuffix(" s");
    auto* narration=new QCheckBox(QString::fromUtf8("Автозапуск озвучки"));
    auto* hotspot=new QLineEdit;
    layout->addRow(QString::fromUtf8("Сцена"),sceneBox);
    layout->addRow(QString::fromUtf8("Длительность"),duration);
    layout->addRow("",narration);
    layout->addRow(QString::fromUtf8("Hotspot ID"),hotspot);
    auto* buttons=new QDialogButtonBox(QDialogButtonBox::Ok|QDialogButtonBox::Cancel);
    layout->addRow(buttons);
    connect(buttons,&QDialogButtonBox::accepted,&dialog,&QDialog::accept);
    connect(buttons,&QDialogButtonBox::rejected,&dialog,&QDialog::reject);
    if(dialog.exec()!=QDialog::Accepted) return;

    QJsonObject guide=m_project.guide;
    QJsonArray steps=guide.value("steps").toArray();
    steps.append(QJsonObject{
        {"id","guide-"+QUuid::createUuid().toString(QUuid::WithoutBraces).left(8)},
        {"sceneId",sceneBox->currentData().toString()},
        {"duration",duration->value()},
        {"narrationAuto",narration->isChecked()},
        {"highlightHotspotId",hotspot->text().trimmed()}
    });
    guide.insert("steps",steps);
    m_project.guide=guide;
    refreshGuideTable();
}

void ProjectOptionsDialog::editGuideStep() {
    const int row=m_guideTable->currentRow();
    QJsonObject guide=m_project.guide;
    QJsonArray steps=guide.value("steps").toArray();
    if(row<0||row>=steps.size()) return;
    QJsonObject current=steps.at(row).toObject();

    QDialog dialog(this);
    dialog.setWindowTitle(QString::fromUtf8("Шаг гида"));
    auto* layout=new QFormLayout(&dialog);
    auto* sceneBox=new QComboBox;
    for(const auto& scene:m_project.scenes){
        sceneBox->addItem(scene.title,scene.id);
        if(scene.id==current.value("sceneId").toString()) sceneBox->setCurrentIndex(sceneBox->count()-1);
    }
    auto* duration=new QSpinBox;
    duration->setRange(2,600); duration->setValue(current.value("duration").toInt(12)); duration->setSuffix(" s");
    auto* narration=new QCheckBox(QString::fromUtf8("Автозапуск озвучки"));
    narration->setChecked(current.value("narrationAuto").toBool());
    auto* hotspot=new QLineEdit(current.value("highlightHotspotId").toString());
    layout->addRow(QString::fromUtf8("Сцена"),sceneBox);
    layout->addRow(QString::fromUtf8("Длительность"),duration);
    layout->addRow("",narration);
    layout->addRow(QString::fromUtf8("Hotspot ID"),hotspot);
    auto* buttons=new QDialogButtonBox(QDialogButtonBox::Ok|QDialogButtonBox::Cancel);
    layout->addRow(buttons);
    connect(buttons,&QDialogButtonBox::accepted,&dialog,&QDialog::accept);
    connect(buttons,&QDialogButtonBox::rejected,&dialog,&QDialog::reject);
    if(dialog.exec()!=QDialog::Accepted) return;

    current.insert("sceneId",sceneBox->currentData().toString());
    current.insert("duration",duration->value());
    current.insert("narrationAuto",narration->isChecked());
    current.insert("highlightHotspotId",hotspot->text().trimmed());
    steps.replace(row,current);
    guide.insert("steps",steps);
    m_project.guide=guide;
    refreshGuideTable();
    m_guideTable->selectRow(row);
}

void ProjectOptionsDialog::removeGuideStep() {
    const int row=m_guideTable->currentRow();
    QJsonObject guide=m_project.guide;
    QJsonArray steps=guide.value("steps").toArray();
    if(row<0||row>=steps.size()) return;
    steps.removeAt(row);
    guide.insert("steps",steps);
    m_project.guide=guide;
    refreshGuideTable();
}
