#include "SceneObjectsDialog.h"

#include "io/ProjectStorage.h"

#include <QCheckBox>
#include <QColorDialog>
#include <QComboBox>
#include <QDialogButtonBox>
#include <QDoubleSpinBox>
#include <QFileDialog>
#include <QFormLayout>
#include <QHeaderView>
#include <QHBoxLayout>
#include <QJsonArray>
#include <QJsonObject>
#include <QLineEdit>
#include <QMessageBox>
#include <QPushButton>
#include <QSpinBox>
#include <QTabWidget>
#include <QTableWidget>
#include <QTextEdit>
#include <QVBoxLayout>
#include <QUuid>

namespace {
QString makeId(const QString& prefix) {
    return prefix + "-" + QUuid::createUuid().toString(QUuid::WithoutBraces).left(8);
}

QSpinBox* percentSpin(int min, int max, int value) {
    auto* s = new QSpinBox;
    s->setRange(min,max);
    s->setValue(value);
    s->setSuffix("%");
    return s;
}

QString boolText(bool value) {
    return value ? QString::fromUtf8("Да") : QString::fromUtf8("Нет");
}
}

SceneObjectsDialog::SceneObjectsDialog(
    Scene scene,
    const Project& project,
    const QString& projectDirectory,
    QWidget* parent
)
    : QDialog(parent)
    , m_scene(std::move(scene))
    , m_project(project)
    , m_projectDirectory(projectDirectory)
{
    setWindowTitle(QString::fromUtf8("Объекты сцены — %1").arg(m_scene.title));
    resize(940,650);
    buildUi();
    refreshTables();
}

void SceneObjectsDialog::buildUi() {
    auto* root = new QVBoxLayout(this);
    auto* tabs = new QTabWidget(this);

    auto* textPage = new QWidget;
    auto* textLayout = new QVBoxLayout(textPage);
    m_textTable = new QTableWidget(0,8,textPage);
    m_textTable->setHorizontalHeaderLabels({
        QString::fromUtf8("Тип"), QString::fromUtf8("Текст"),
        "X","Y",QString::fromUtf8("Ширина"),QString::fromUtf8("Шрифт"),
        QString::fromUtf8("Видим"),"Z"
    });
    m_textTable->horizontalHeader()->setSectionResizeMode(1,QHeaderView::Stretch);
    m_textTable->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_textTable->setEditTriggers(QAbstractItemView::NoEditTriggers);
    textLayout->addWidget(m_textTable,1);
    auto* textButtons = new QHBoxLayout;
    auto* addText = new QPushButton(QString::fromUtf8("Добавить текст"));
    auto* editText = new QPushButton(QString::fromUtf8("Изменить"));
    auto* delText = new QPushButton(QString::fromUtf8("Удалить"));
    textButtons->addWidget(addText); textButtons->addWidget(editText); textButtons->addWidget(delText); textButtons->addStretch();
    textLayout->addLayout(textButtons);
    connect(addText,&QPushButton::clicked,this,&SceneObjectsDialog::addText);
    connect(editText,&QPushButton::clicked,this,&SceneObjectsDialog::editText);
    connect(delText,&QPushButton::clicked,this,&SceneObjectsDialog::deleteText);
    connect(m_textTable,&QTableWidget::cellDoubleClicked,this,[this](int,int){ editText(); });

    auto* mediaPage = new QWidget;
    auto* mediaLayout = new QVBoxLayout(mediaPage);
    m_mediaTable = new QTableWidget(0,8,mediaPage);
    m_mediaTable->setHorizontalHeaderLabels({
        QString::fromUtf8("Тип"),QString::fromUtf8("Название"),
        QString::fromUtf8("Файл / цель"),"X","Y",QString::fromUtf8("Размер"),
        QString::fromUtf8("Видим"),"Z"
    });
    m_mediaTable->horizontalHeader()->setSectionResizeMode(1,QHeaderView::Stretch);
    m_mediaTable->horizontalHeader()->setSectionResizeMode(2,QHeaderView::Stretch);
    m_mediaTable->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_mediaTable->setEditTriggers(QAbstractItemView::NoEditTriggers);
    mediaLayout->addWidget(m_mediaTable,1);
    auto* mediaButtons = new QHBoxLayout;
    auto* addMedia = new QPushButton(QString::fromUtf8("Добавить медиа"));
    auto* editMedia = new QPushButton(QString::fromUtf8("Изменить"));
    auto* delMedia = new QPushButton(QString::fromUtf8("Удалить"));
    mediaButtons->addWidget(addMedia); mediaButtons->addWidget(editMedia); mediaButtons->addWidget(delMedia); mediaButtons->addStretch();
    mediaLayout->addLayout(mediaButtons);
    connect(addMedia,&QPushButton::clicked,this,&SceneObjectsDialog::addMedia);
    connect(editMedia,&QPushButton::clicked,this,&SceneObjectsDialog::editMedia);
    connect(delMedia,&QPushButton::clicked,this,&SceneObjectsDialog::deleteMedia);
    connect(m_mediaTable,&QTableWidget::cellDoubleClicked,this,[this](int,int){ editMedia(); });

    tabs->addTab(textPage,QString::fromUtf8("Текст"));
    tabs->addTab(mediaPage,QString::fromUtf8("Медиа"));
    root->addWidget(tabs,1);

    auto* buttons = new QDialogButtonBox(QDialogButtonBox::Ok|QDialogButtonBox::Cancel);
    root->addWidget(buttons);
    connect(buttons,&QDialogButtonBox::accepted,this,&QDialog::accept);
    connect(buttons,&QDialogButtonBox::rejected,this,&QDialog::reject);
}

void SceneObjectsDialog::refreshTables() {
    m_textTable->setRowCount(0);
    for(int i=0;i<m_scene.textObjects.size();++i){
        const QJsonObject o=m_scene.textObjects.at(i).toObject();
        const int r=m_textTable->rowCount();
        m_textTable->insertRow(r);
        const QStringList cells{
            o.value("type").toString("description"),
            o.value("text").toString(),
            QString::number(o.value("x").toDouble(5),'f',0)+"%",
            QString::number(o.value("y").toDouble(70),'f',0)+"%",
            QString::number(o.value("width").toDouble(42),'f',0)+"%",
            QString::number(o.value("fontSize").toInt(20)),
            boolText(o.value("visible").toBool(true)),
            QString::number(o.value("zIndex").toInt(10))
        };
        for(int c=0;c<cells.size();++c) m_textTable->setItem(r,c,new QTableWidgetItem(cells[c]));
    }

    m_mediaTable->setRowCount(0);
    for(int i=0;i<m_scene.mediaObjects.size();++i){
        const QJsonObject o=m_scene.mediaObjects.at(i).toObject();
        const int r=m_mediaTable->rowCount();
        m_mediaTable->insertRow(r);
        QString target=o.value("data").toString();
        if(o.value("type").toString()=="button"){
            target=!o.value("targetSceneId").toString().isEmpty()?o.value("targetSceneId").toString():o.value("url").toString();
        } else if(o.value("type").toString()=="gallery") {
            target=QString::fromUtf8("%1 фото").arg(o.value("gallery").toArray().size());
        }
        const QStringList cells{
            o.value("type").toString("image"),
            o.value("title").toString(),
            target,
            QString::number(o.value("x").toDouble(10),'f',0)+"%",
            QString::number(o.value("y").toDouble(20),'f',0)+"%",
            QString("%1×%2").arg(o.value("width").toInt(36)).arg(o.value("height").toInt(32)),
            boolText(o.value("visible").toBool(true)),
            QString::number(o.value("zIndex").toInt(20))
        };
        for(int c=0;c<cells.size();++c) m_mediaTable->setItem(r,c,new QTableWidgetItem(cells[c]));
    }
}

QJsonObject SceneObjectsDialog::editTextObject(const QJsonObject& input, bool* ok) {
    QDialog dialog(this);
    dialog.setWindowTitle(input.isEmpty()?QString::fromUtf8("Новый текст"):QString::fromUtf8("Изменить текст"));
    auto* form=new QFormLayout(&dialog);

    auto* type=new QComboBox;
    type->addItem(QString::fromUtf8("Заголовок"),"title");
    type->addItem(QString::fromUtf8("Описание"),"description");
    type->setCurrentIndex(qMax(0,type->findData(input.value("type").toString("description"))));

    auto* text=new QTextEdit;
    text->setPlainText(input.value("text").toString());
    text->setMinimumHeight(100);

    auto* x=percentSpin(0,100,input.value("x").toInt(5));
    auto* y=percentSpin(0,100,input.value("y").toInt(type->currentData().toString()=="title"?8:70));
    auto* width=percentSpin(10,90,input.value("width").toInt(type->currentData().toString()=="title"?55:42));
    auto* fontSize=new QSpinBox;
    fontSize->setRange(12,96); fontSize->setValue(input.value("fontSize").toInt(type->currentData().toString()=="title"?42:20));

    auto* color=new QLineEdit(input.value("color").toString("#ffffff"));
    auto* chooseColor=new QPushButton(QString::fromUtf8("Цвет…"));
    auto* colorRow=new QWidget;
    auto* colorLayout=new QHBoxLayout(colorRow);
    colorLayout->setContentsMargins(0,0,0,0);
    colorLayout->addWidget(color,1); colorLayout->addWidget(chooseColor);
    connect(chooseColor,&QPushButton::clicked,&dialog,[&]{
        const QColor c=QColorDialog::getColor(QColor(color->text()),&dialog);
        if(c.isValid()) color->setText(c.name());
    });

    auto* align=new QComboBox; align->addItems({"left","center","right"}); align->setCurrentText(input.value("align").toString("left"));
    auto* background=new QComboBox; background->addItems({"none","dark","light"}); background->setCurrentText(input.value("background").toString("none"));
    auto* animation=new QComboBox; animation->addItems({"none","fade","slide"}); animation->setCurrentText(input.value("animation").toString("fade"));
    auto* visible=new QCheckBox(QString::fromUtf8("Видимый")); visible->setChecked(input.value("visible").toBool(true));
    auto* locked=new QCheckBox(QString::fromUtf8("Заблокирован")); locked->setChecked(input.value("locked").toBool(false));
    auto* zIndex=new QSpinBox; zIndex->setRange(-100,1000); zIndex->setValue(input.value("zIndex").toInt(10));

    form->addRow(QString::fromUtf8("Тип"),type);
    form->addRow(QString::fromUtf8("Текст"),text);
    form->addRow("X",x); form->addRow("Y",y); form->addRow(QString::fromUtf8("Ширина"),width);
    form->addRow(QString::fromUtf8("Шрифт"),fontSize); form->addRow(QString::fromUtf8("Цвет"),colorRow);
    form->addRow(QString::fromUtf8("Выравнивание"),align);
    form->addRow(QString::fromUtf8("Фон"),background); form->addRow(QString::fromUtf8("Анимация"),animation);
    form->addRow("",visible); form->addRow("",locked); form->addRow("Z",zIndex);

    auto* buttons=new QDialogButtonBox(QDialogButtonBox::Ok|QDialogButtonBox::Cancel);
    form->addRow(buttons);
    connect(buttons,&QDialogButtonBox::accepted,&dialog,&QDialog::accept);
    connect(buttons,&QDialogButtonBox::rejected,&dialog,&QDialog::reject);

    if(dialog.exec()!=QDialog::Accepted){ if(ok)*ok=false; return input; }
    if(ok)*ok=true;
    return QJsonObject{
        {"id",input.value("id").toString(makeId("text"))},
        {"type",type->currentData().toString()},
        {"text",text->toPlainText()},
        {"x",x->value()},{"y",y->value()},{"width",width->value()},
        {"fontSize",fontSize->value()},{"color",color->text()},
        {"align",align->currentText()},{"background",background->currentText()},
        {"animation",animation->currentText()},{"visible",visible->isChecked()},
        {"locked",locked->isChecked()},{"zIndex",zIndex->value()}
    };
}

QJsonObject SceneObjectsDialog::editMediaObject(const QJsonObject& input, bool* ok) {
    QDialog dialog(this);
    dialog.setWindowTitle(input.isEmpty()?QString::fromUtf8("Новое медиа"):QString::fromUtf8("Изменить медиа"));
    auto* form=new QFormLayout(&dialog);

    auto* type=new QComboBox;
    for(const auto& v:QStringList{"image","stereo-photo","gallery","video","audio","pdf","button"}) type->addItem(v,v);
    type->setCurrentIndex(qMax(0,type->findData(input.value("type").toString("image"))));
    auto* title=new QLineEdit(input.value("title").toString());

    auto* source=new QLineEdit(input.value("data").toString());
    source->setReadOnly(true);
    auto* choose=new QPushButton(QString::fromUtf8("Файл…"));
    auto* sourceRow=new QWidget;
    auto* sourceLayout=new QHBoxLayout(sourceRow); sourceLayout->setContentsMargins(0,0,0,0);
    sourceLayout->addWidget(source,1); sourceLayout->addWidget(choose);

    QJsonArray gallery=input.value("gallery").toArray();
    connect(choose,&QPushButton::clicked,&dialog,[&,this]{
        const QString t=type->currentData().toString();
        if(t=="button") return;
        if(t=="gallery"){
            const QStringList files=QFileDialog::getOpenFileNames(&dialog,QString::fromUtf8("Галерея"),QString(),QString::fromUtf8("Изображения (*.jpg *.jpeg *.png *.webp)"));
            if(files.isEmpty()) return;
            gallery=QJsonArray{};
            for(const QString& file:files){
                QString error;
                const QString rel=ProjectStorage::importAsset(m_projectDirectory,file,"media",&error);
                if(!rel.isEmpty()) gallery.append(QJsonObject{{"data",rel},{"filename",QFileInfo(file).fileName()}});
            }
            source->setText(QString::fromUtf8("%1 файлов").arg(gallery.size()));
            return;
        }

        QString filter=QString::fromUtf8("Все файлы (*.*)");
        if(t=="image"||t=="stereo-photo") filter=QString::fromUtf8("Изображения (*.jpg *.jpeg *.png *.webp)");
        else if(t=="video") filter=QString::fromUtf8("Видео (*.mp4 *.webm *.mkv *.mov)");
        else if(t=="audio") filter=QString::fromUtf8("Аудио (*.mp3 *.wav *.ogg *.flac *.m4a)");
        else if(t=="pdf") filter="PDF (*.pdf)";
        const QString file=QFileDialog::getOpenFileName(&dialog,QString::fromUtf8("Медиа"),QString(),filter);
        if(file.isEmpty()) return;
        QString error;
        const QString rel=ProjectStorage::importAsset(m_projectDirectory,file,"media",&error);
        if(rel.isEmpty()) QMessageBox::critical(&dialog,QString::fromUtf8("Импорт"),error);
        else source->setText(rel);
    });

    auto* url=new QLineEdit(input.value("url").toString());
    auto* target=new QComboBox;
    target->addItem(QString::fromUtf8("— нет —"),"");
    for(const auto& scene:m_project.scenes) target->addItem(scene.title,scene.id);
    target->setCurrentIndex(qMax(0,target->findData(input.value("targetSceneId").toString())));

    auto* x=percentSpin(0,100,input.value("x").toInt(10));
    auto* y=percentSpin(0,100,input.value("y").toInt(20));
    auto* width=percentSpin(8,95,input.value("width").toInt(36));
    auto* height=percentSpin(6,90,input.value("height").toInt(32));
    auto* fit=new QComboBox; fit->addItems({"contain","cover"}); fit->setCurrentText(input.value("fit").toString("contain"));
    auto* autoplay=new QCheckBox(QString::fromUtf8("Автозапуск")); autoplay->setChecked(input.value("autoplay").toBool());
    auto* loop=new QCheckBox(QString::fromUtf8("Повтор")); loop->setChecked(input.value("loop").toBool());
    auto* muted=new QCheckBox(QString::fromUtf8("Mute")); muted->setChecked(input.value("muted").toBool(true));
    auto* volume=new QSpinBox; volume->setRange(0,100); volume->setValue(input.value("volume").toInt(80)); volume->setSuffix("%");
    auto* stereo=new QComboBox; stereo->addItems({"FLAT_LR","FLAT_TB"}); stereo->setCurrentText(input.value("stereoProjection").toString("FLAT_LR"));
    auto* background=new QComboBox; background->addItems({"none","dark","light"}); background->setCurrentText(input.value("background").toString("dark"));
    auto* animation=new QComboBox; animation->addItems({"none","fade","slide","zoom"}); animation->setCurrentText(input.value("animation").toString("fade"));
    auto* visible=new QCheckBox(QString::fromUtf8("Видимый")); visible->setChecked(input.value("visible").toBool(true));
    auto* locked=new QCheckBox(QString::fromUtf8("Заблокирован")); locked->setChecked(input.value("locked").toBool(false));
    auto* zIndex=new QSpinBox; zIndex->setRange(-100,1000); zIndex->setValue(input.value("zIndex").toInt(20));

    form->addRow(QString::fromUtf8("Тип"),type); form->addRow(QString::fromUtf8("Название"),title);
    form->addRow(QString::fromUtf8("Файл"),sourceRow);
    form->addRow("URL",url); form->addRow(QString::fromUtf8("Целевая сцена"),target);
    form->addRow("X",x); form->addRow("Y",y); form->addRow(QString::fromUtf8("Ширина"),width); form->addRow(QString::fromUtf8("Высота"),height);
    form->addRow("Fit",fit); form->addRow("",autoplay); form->addRow("",loop); form->addRow("",muted);
    form->addRow(QString::fromUtf8("Громкость"),volume); form->addRow(QString::fromUtf8("Stereo"),stereo);
    form->addRow(QString::fromUtf8("Фон"),background); form->addRow(QString::fromUtf8("Анимация"),animation);
    form->addRow("",visible); form->addRow("",locked); form->addRow("Z",zIndex);

    auto* buttons=new QDialogButtonBox(QDialogButtonBox::Ok|QDialogButtonBox::Cancel);
    form->addRow(buttons);
    connect(buttons,&QDialogButtonBox::accepted,&dialog,&QDialog::accept);
    connect(buttons,&QDialogButtonBox::rejected,&dialog,&QDialog::reject);

    if(dialog.exec()!=QDialog::Accepted){ if(ok)*ok=false; return input; }
    if(ok)*ok=true;

    QJsonObject out{
        {"id",input.value("id").toString(makeId("media"))},
        {"type",type->currentData().toString()},
        {"title",title->text()},
        {"data",type->currentData().toString()=="gallery"?QString():source->text()},
        {"filename",QFileInfo(source->text()).fileName()},
        {"gallery",gallery},
        {"url",url->text()},
        {"targetSceneId",target->currentData().toString()},
        {"x",x->value()},{"y",y->value()},{"width",width->value()},{"height",height->value()},
        {"fit",fit->currentText()},{"autoplay",autoplay->isChecked()},{"loop",loop->isChecked()},
        {"volume",volume->value()},{"audioStyle","compact"},{"stereoProjection",stereo->currentText()},
        {"muted",muted->isChecked()},{"background",background->currentText()},
        {"animation",animation->currentText()},{"visible",visible->isChecked()},
        {"locked",locked->isChecked()},{"zIndex",zIndex->value()}
    };
    return out;
}

void SceneObjectsDialog::addText() {
    bool ok=false;
    QJsonObject o=editTextObject({},&ok);
    if(!ok) return;
    m_scene.textObjects.append(o);
    refreshTables();
    m_textTable->selectRow(m_textTable->rowCount()-1);
}

void SceneObjectsDialog::editText() {
    const int row=m_textTable->currentRow();
    if(row<0||row>=m_scene.textObjects.size()) return;
    bool ok=false;
    QJsonObject o=editTextObject(m_scene.textObjects.at(row).toObject(),&ok);
    if(!ok) return;
    m_scene.textObjects.replace(row,o);
    refreshTables(); m_textTable->selectRow(row);
}

void SceneObjectsDialog::deleteText() {
    const int row=m_textTable->currentRow();
    if(row<0||row>=m_scene.textObjects.size()) return;
    m_scene.textObjects.removeAt(row); refreshTables();
}

void SceneObjectsDialog::addMedia() {
    bool ok=false;
    QJsonObject o=editMediaObject({},&ok);
    if(!ok) return;
    m_scene.mediaObjects.append(o);
    refreshTables(); m_mediaTable->selectRow(m_mediaTable->rowCount()-1);
}

void SceneObjectsDialog::editMedia() {
    const int row=m_mediaTable->currentRow();
    if(row<0||row>=m_scene.mediaObjects.size()) return;
    bool ok=false;
    QJsonObject o=editMediaObject(m_scene.mediaObjects.at(row).toObject(),&ok);
    if(!ok) return;
    m_scene.mediaObjects.replace(row,o);
    refreshTables(); m_mediaTable->selectRow(row);
}

void SceneObjectsDialog::deleteMedia() {
    const int row=m_mediaTable->currentRow();
    if(row<0||row>=m_scene.mediaObjects.size()) return;
    m_scene.mediaObjects.removeAt(row); refreshTables();
}
