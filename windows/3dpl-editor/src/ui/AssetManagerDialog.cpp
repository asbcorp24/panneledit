#include "AssetManagerDialog.h"

#include <QDesktopServices>
#include <QDialogButtonBox>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QHeaderView>
#include <QHBoxLayout>
#include <QJsonArray>
#include <QJsonObject>
#include <QLabel>
#include <QMessageBox>
#include <QPushButton>
#include <QTableWidget>
#include <QUrl>
#include <QVBoxLayout>

namespace {

QString formatBytes(qint64 bytes) {
    const double value = static_cast<double>(bytes);
    if (bytes >= 1024ll * 1024ll * 1024ll)
        return QString::number(value / (1024.0 * 1024.0 * 1024.0), 'f', 2) + " GB";
    if (bytes >= 1024ll * 1024ll)
        return QString::number(value / (1024.0 * 1024.0), 'f', 1) + " MB";
    if (bytes >= 1024ll)
        return QString::number(value / 1024.0, 'f', 1) + " KB";
    return QString::number(bytes) + " B";
}

void collectMediaObjectRefs(const QJsonArray& objects, QSet<QString>& refs) {
    for (const auto& value : objects) {
        const QJsonObject object = value.toObject();
        const QString data = object.value("data").toString();
        if (!data.isEmpty()) refs.insert(data);

        const auto gallery = object.value("gallery").toArray();
        for (const auto& galleryValue : gallery) {
            const QString item = galleryValue.toObject().value("data").toString();
            if (!item.isEmpty()) refs.insert(item);
        }
    }
}

}

AssetManagerDialog::AssetManagerDialog(
    const Project& project,
    const QString& projectDirectory,
    QWidget* parent
)
    : QDialog(parent)
    , m_project(project)
    , m_projectDirectory(projectDirectory)
{
    setWindowTitle(QString::fromUtf8("Asset Manager"));
    resize(1050, 650);
    buildUi();
    refresh();
}

void AssetManagerDialog::buildUi() {
    auto* root = new QVBoxLayout(this);

    m_summary = new QLabel(this);
    m_summary->setStyleSheet("color:#8fa5c7;padding:4px;");
    root->addWidget(m_summary);

    m_table = new QTableWidget(0, 6, this);
    m_table->setHorizontalHeaderLabels({
        QString::fromUtf8("Файл"),
        QString::fromUtf8("Категория"),
        QString::fromUtf8("Размер"),
        QString::fromUtf8("Статус"),
        QString::fromUtf8("Используется"),
        QString::fromUtf8("Путь")
    });
    m_table->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_table->setSelectionMode(QAbstractItemView::ExtendedSelection);
    m_table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_table->horizontalHeader()->setSectionResizeMode(0, QHeaderView::Stretch);
    m_table->horizontalHeader()->setSectionResizeMode(5, QHeaderView::Stretch);
    root->addWidget(m_table, 1);

    auto* actions = new QHBoxLayout;
    auto* refreshButton = new QPushButton(QString::fromUtf8("Обновить"), this);
    m_deleteUnused = new QPushButton(QString::fromUtf8("Удалить все неиспользуемые"), this);
    m_deleteSelected = new QPushButton(QString::fromUtf8("Удалить выбранные"), this);
    auto* openFolder = new QPushButton(QString::fromUtf8("Открыть папку"), this);

    actions->addWidget(refreshButton);
    actions->addWidget(m_deleteUnused);
    actions->addWidget(m_deleteSelected);
    actions->addWidget(openFolder);
    actions->addStretch();
    root->addLayout(actions);

    auto* buttons = new QDialogButtonBox(QDialogButtonBox::Close, this);
    root->addWidget(buttons);

    connect(refreshButton, &QPushButton::clicked, this, &AssetManagerDialog::refresh);
    connect(m_deleteUnused, &QPushButton::clicked, this, &AssetManagerDialog::deleteUnused);
    connect(m_deleteSelected, &QPushButton::clicked, this, &AssetManagerDialog::deleteSelected);
    connect(openFolder, &QPushButton::clicked, this, &AssetManagerDialog::openSelectedFolder);
    connect(buttons, &QDialogButtonBox::rejected, this, &QDialog::reject);
}

QString AssetManagerDialog::normalizedRelative(const QString& path) const {
    if (path.isEmpty()) return {};
    QString value = path;
    value.replace('\\', '/');
    while (value.startsWith("./")) value.remove(0, 2);
    while (value.startsWith('/')) value.remove(0, 1);
    return value;
}

bool AssetManagerDialog::isInsideAssets(const QString& relative) const {
    const QString n = normalizedRelative(relative);
    return n.startsWith("assets/", Qt::CaseInsensitive);
}

QSet<QString> AssetManagerDialog::collectReferences() const {
    QSet<QString> refs;

    auto add = [&](const QString& value) {
        const QString n = normalizedRelative(value);
        if (isInsideAssets(n)) refs.insert(n);
    };

    add(m_project.musicSource);

    for (const Scene& scene : m_project.scenes) {
        add(scene.source);
        add(scene.backgroundImageSource);
        add(scene.musicSource);
        add(scene.narrationSource);

        for (const auto& row : scene.frames)
            for (const QString& frame : row)
                add(frame);

        collectMediaObjectRefs(scene.mediaObjects, refs);
    }

    return refs;
}

void AssetManagerDialog::refresh() {
    m_table->setRowCount(0);

    const QSet<QString> refs = collectReferences();
    const QDir projectDir(m_projectDirectory);
    const QDir assetsDir(projectDir.filePath("assets"));

    qint64 totalBytes = 0;
    qint64 unusedBytes = 0;
    int fileCount = 0;
    int unusedCount = 0;
    int missingCount = 0;

    if (assetsDir.exists()) {
        const auto files = assetsDir.entryInfoList(QDir::NoDotAndDotDot | QDir::Files | QDir::AllDirs);
        QList<QFileInfo> stack = files;
        while (!stack.isEmpty()) {
            const QFileInfo info = stack.takeFirst();
            if (info.isDir()) {
                QDir d(info.absoluteFilePath());
                const auto children = d.entryInfoList(QDir::NoDotAndDotDot | QDir::Files | QDir::AllDirs);
                for (const auto& child : children) stack.push_back(child);
                continue;
            }

            const QString relative = normalizedRelative(projectDir.relativeFilePath(info.absoluteFilePath()));
            const bool used = refs.contains(relative);
            const int row = m_table->rowCount();
            m_table->insertRow(row);

            const QString category = relative.section('/', 1, 1);
            const QString status = used ? QString::fromUtf8("OK") : QString::fromUtf8("Не используется");

            auto* nameItem = new QTableWidgetItem(info.fileName());
            nameItem->setData(Qt::UserRole, relative);
            m_table->setItem(row, 0, nameItem);
            m_table->setItem(row, 1, new QTableWidgetItem(category));
            m_table->setItem(row, 2, new QTableWidgetItem(formatBytes(info.size())));
            m_table->setItem(row, 3, new QTableWidgetItem(status));
            m_table->setItem(row, 4, new QTableWidgetItem(used ? QString::fromUtf8("Да") : QString::fromUtf8("Нет")));
            m_table->setItem(row, 5, new QTableWidgetItem(relative));

            totalBytes += info.size();
            ++fileCount;
            if (!used) {
                unusedBytes += info.size();
                ++unusedCount;
            }
        }
    }

    for (const QString& ref : refs) {
        if (!QFileInfo::exists(projectDir.filePath(ref))) ++missingCount;
    }

    m_summary->setText(
        QString::fromUtf8(
            "Файлов: %1  •  Всего: %2  •  Не используется: %3 (%4)  •  Битых ссылок: %5"
        )
            .arg(fileCount)
            .arg(formatBytes(totalBytes))
            .arg(unusedCount)
            .arg(formatBytes(unusedBytes))
            .arg(missingCount)
    );

    m_deleteUnused->setEnabled(unusedCount > 0);
    m_deleteSelected->setEnabled(m_table->rowCount() > 0);
}

void AssetManagerDialog::deleteUnused() {
    const QSet<QString> refs = collectReferences();
    QDir projectDir(m_projectDirectory);

    QStringList toDelete;
    for (int row = 0; row < m_table->rowCount(); ++row) {
        const QString relative = m_table->item(row, 0)->data(Qt::UserRole).toString();
        if (!refs.contains(relative)) toDelete.push_back(relative);
    }
    if (toDelete.isEmpty()) return;

    if (QMessageBox::warning(
            this,
            QString::fromUtf8("Удаление assets"),
            QString::fromUtf8("Удалить %1 неиспользуемых файлов? Это действие нельзя отменить.")
                .arg(toDelete.size()),
            QMessageBox::Yes | QMessageBox::No,
            QMessageBox::No
        ) != QMessageBox::Yes) {
        return;
    }

    int removed = 0;
    for (const QString& relative : toDelete) {
        if (QFile::remove(projectDir.filePath(relative))) ++removed;
    }
    refresh();
    QMessageBox::information(
        this,
        QString::fromUtf8("Asset Manager"),
        QString::fromUtf8("Удалено файлов: %1").arg(removed)
    );
}

void AssetManagerDialog::deleteSelected() {
    const auto ranges = m_table->selectedRanges();
    if (ranges.isEmpty()) return;

    QSet<int> rows;
    for (const auto& range : ranges)
        for (int row = range.topRow(); row <= range.bottomRow(); ++row)
            rows.insert(row);

    const QSet<QString> refs = collectReferences();
    QStringList deletable;
    QStringList blocked;

    for (int row : rows) {
        const QString relative = m_table->item(row, 0)->data(Qt::UserRole).toString();
        if (refs.contains(relative)) blocked.push_back(relative);
        else deletable.push_back(relative);
    }

    if (!blocked.isEmpty()) {
        QMessageBox::information(
            this,
            QString::fromUtf8("Asset Manager"),
            QString::fromUtf8("Используемые файлы не будут удалены:\n%1")
                .arg(blocked.join("\n"))
        );
    }
    if (deletable.isEmpty()) return;

    if (QMessageBox::question(
            this,
            QString::fromUtf8("Удаление"),
            QString::fromUtf8("Удалить выбранные неиспользуемые файлы (%1)?")
                .arg(deletable.size())
        ) != QMessageBox::Yes) {
        return;
    }

    QDir root(m_projectDirectory);
    for (const QString& relative : deletable) QFile::remove(root.filePath(relative));
    refresh();
}

void AssetManagerDialog::openSelectedFolder() {
    int row = m_table->currentRow();
    QString path;
    if (row >= 0) {
        const QString relative = m_table->item(row, 0)->data(Qt::UserRole).toString();
        path = QFileInfo(QDir(m_projectDirectory).filePath(relative)).absolutePath();
    } else {
        path = QDir(m_projectDirectory).filePath("assets");
    }
    QDesktopServices::openUrl(QUrl::fromLocalFile(path));
}
