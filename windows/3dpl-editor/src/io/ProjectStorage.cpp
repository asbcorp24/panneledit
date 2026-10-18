#include "ProjectStorage.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QRegularExpression>
#include <QSaveFile>
#include <QUuid>

namespace {
QString normalizedRelative(QString value) {
    value.replace('\\', '/');
    while (value.startsWith('/')) value.removeFirst();
    return value;
}
}

bool ProjectStorage::ensureLayout(const QString& directory, QString* error) {
    QDir root(directory);
    if (!root.exists() && !QDir().mkpath(directory)) {
        if (error) *error = "Не удалось создать папку проекта";
        return false;
    }

    const QStringList folders{
        "assets",
        "assets/panoramas",
        "assets/object360",
        "assets/stl",
        "assets/xr",
        "assets/audio",
        "assets/media",
        "multires",
        "thumbnails",
        "cache"
    };

    for (const auto& folder : folders) {
        if (!root.mkpath(folder)) {
            if (error) *error = "Не удалось создать " + folder;
            return false;
        }
    }
    return true;
}

bool ProjectStorage::createProject(const QString& directory, Project& project, QString* error) {
    if (!ensureLayout(directory, error)) return false;
    project = Project{};
    return saveProject(directory, project, error);
}

bool ProjectStorage::loadProject(const QString& directory, Project& project, QString* error) {
    QFile file(QDir(directory).filePath("project.json"));
    if (!file.open(QIODevice::ReadOnly)) {
        if (error) *error = "Не удалось открыть project.json";
        return false;
    }

    QJsonParseError parseError;
    const auto document = QJsonDocument::fromJson(file.readAll(), &parseError);
    if (parseError.error != QJsonParseError::NoError || !document.isObject()) {
        if (error) *error = "Ошибка JSON: " + parseError.errorString();
        return false;
    }

    project = Project::fromJson(document.object());
    return true;
}

bool ProjectStorage::saveProject(const QString& directory, const Project& project, QString* error) {
    if (!ensureLayout(directory, error)) return false;

    QSaveFile file(QDir(directory).filePath("project.json"));
    if (!file.open(QIODevice::WriteOnly)) {
        if (error) *error = "Не удалось записать project.json";
        return false;
    }

    file.write(QJsonDocument(project.toJson()).toJson(QJsonDocument::Indented));
    if (!file.commit()) {
        if (error) *error = "Не удалось атомарно сохранить project.json";
        return false;
    }
    return true;
}

QString ProjectStorage::importAsset(
    const QString& projectDirectory,
    const QString& sourceFile,
    const QString& category,
    QString* error
) {
    if (!ensureLayout(projectDirectory, error)) return {};

    const QFileInfo sourceInfo(sourceFile);
    if (!sourceInfo.isFile()) {
        if (error) *error = "Исходный файл не найден";
        return {};
    }

    QString safeCategory = category;
    safeCategory.remove("..");
    safeCategory = normalizedRelative(safeCategory);

    const QString targetDir = QDir(projectDirectory).filePath("assets/" + safeCategory);
    QDir().mkpath(targetDir);

    const QString stem = sourceInfo.completeBaseName()
        .replace(QRegularExpression("[^A-Za-z0-9А-Яа-я_-]+"), "_")
        .left(80);
    const QString targetName =
        stem + "_" + QUuid::createUuid().toString(QUuid::Id128).left(8) +
        (sourceInfo.suffix().isEmpty() ? QString() : "." + sourceInfo.suffix().toLower());

    const QString target = QDir(targetDir).filePath(targetName);
    if (!QFile::copy(sourceFile, target)) {
        if (error) *error = "Не удалось скопировать asset";
        return {};
    }

    return normalizedRelative(QDir(projectDirectory).relativeFilePath(target));
}

QString ProjectStorage::resolveAsset(const QString& projectDirectory, const QString& relativePath) {
    if (relativePath.isEmpty()) return {};
    const QFileInfo candidate(QDir(projectDirectory).filePath(relativePath));
    const QString root = QFileInfo(projectDirectory).canonicalFilePath();
    const QString resolved = candidate.canonicalFilePath();
    if (root.isEmpty() || resolved.isEmpty()) return {};
    if (!resolved.startsWith(root + QDir::separator(), Qt::CaseInsensitive)) return {};
    return resolved;
}
