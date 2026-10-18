#pragma once

#include <QFile>
#include <QString>
#include <QVector>

class ZipWriter final {
public:
    explicit ZipWriter(const QString &fileName);
    ~ZipWriter();

    bool isOpen() const;
    QString errorString() const;

    bool addFile(const QString &archiveName, const QByteArray &data);
    bool addFileFromDisk(const QString &archiveName, const QString &diskPath);
    bool close();

private:
    struct Entry {
        QByteArray name;
        quint32 crc = 0;
        quint32 size = 0;
        quint32 offset = 0;
    };

    static quint32 crc32(const QByteArray &data);
    static QByteArray normalizedName(const QString &name);
    static void write16(QFile &file, quint16 value);
    static void write32(QFile &file, quint32 value);

    QFile m_file;
    QVector<Entry> m_entries;
    QString m_error;
    bool m_closed = false;
};
