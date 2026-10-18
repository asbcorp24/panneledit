#include "ZipWriter.h"

#include <QFileInfo>

ZipWriter::ZipWriter(const QString &fileName) : m_file(fileName) {
    if (!m_file.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        m_error = m_file.errorString();
    }
}

ZipWriter::~ZipWriter() {
    if (m_file.isOpen() && !m_closed) {
        close();
    }
}

bool ZipWriter::isOpen() const {
    return m_file.isOpen() && m_error.isEmpty() && !m_closed;
}

QString ZipWriter::errorString() const {
    return m_error;
}

QByteArray ZipWriter::normalizedName(const QString &name) {
    QString n = name;
    n.replace('\\', '/');
    while (n.startsWith('/')) n.remove(0, 1);
    return n.toUtf8();
}

void ZipWriter::write16(QFile &file, quint16 value) {
    char b[2] = {
        static_cast<char>(value & 0xff),
        static_cast<char>((value >> 8) & 0xff)
    };
    file.write(b, 2);
}

void ZipWriter::write32(QFile &file, quint32 value) {
    char b[4] = {
        static_cast<char>(value & 0xff),
        static_cast<char>((value >> 8) & 0xff),
        static_cast<char>((value >> 16) & 0xff),
        static_cast<char>((value >> 24) & 0xff)
    };
    file.write(b, 4);
}

quint32 ZipWriter::crc32(const QByteArray &data) {
    quint32 crc = 0xffffffffu;
    for (unsigned char ch : data) {
        crc ^= ch;
        for (int i = 0; i < 8; ++i) {
            crc = (crc >> 1) ^ (0xedb88320u & (0u - (crc & 1u)));
        }
    }
    return crc ^ 0xffffffffu;
}

bool ZipWriter::addFile(const QString &archiveName, const QByteArray &data) {
    if (!isOpen()) return false;

    Entry e;
    e.name = normalizedName(archiveName);
    if (e.name.isEmpty()) {
        m_error = "Пустое имя файла в ZIP";
        return false;
    }
    e.crc = crc32(data);
    e.size = static_cast<quint32>(data.size());
    e.offset = static_cast<quint32>(m_file.pos());

    write32(m_file, 0x04034b50);
    write16(m_file, 20);
    write16(m_file, 0x0800);
    write16(m_file, 0);
    write16(m_file, 0);
    write16(m_file, 0);
    write32(m_file, e.crc);
    write32(m_file, e.size);
    write32(m_file, e.size);
    write16(m_file, static_cast<quint16>(e.name.size()));
    write16(m_file, 0);
    m_file.write(e.name);
    m_file.write(data);

    if (m_file.error() != QFile::NoError) {
        m_error = m_file.errorString();
        return false;
    }
    m_entries.push_back(e);
    return true;
}

bool ZipWriter::addFileFromDisk(const QString &archiveName, const QString &diskPath) {
    QFile file(diskPath);
    if (!file.open(QIODevice::ReadOnly)) {
        m_error = file.errorString();
        return false;
    }
    return addFile(archiveName, file.readAll());
}

bool ZipWriter::close() {
    if (m_closed) return m_error.isEmpty();
    if (!m_file.isOpen()) return false;

    const quint32 centralOffset = static_cast<quint32>(m_file.pos());

    for (const Entry &e : m_entries) {
        write32(m_file, 0x02014b50);
        write16(m_file, 20);
        write16(m_file, 20);
        write16(m_file, 0x0800);
        write16(m_file, 0);
        write16(m_file, 0);
        write16(m_file, 0);
        write32(m_file, e.crc);
        write32(m_file, e.size);
        write32(m_file, e.size);
        write16(m_file, static_cast<quint16>(e.name.size()));
        write16(m_file, 0);
        write16(m_file, 0);
        write16(m_file, 0);
        write16(m_file, 0);
        write32(m_file, 0);
        write32(m_file, e.offset);
        m_file.write(e.name);
    }

    const quint32 centralSize = static_cast<quint32>(m_file.pos()) - centralOffset;
    write32(m_file, 0x06054b50);
    write16(m_file, 0);
    write16(m_file, 0);
    write16(m_file, static_cast<quint16>(m_entries.size()));
    write16(m_file, static_cast<quint16>(m_entries.size()));
    write32(m_file, centralSize);
    write32(m_file, centralOffset);
    write16(m_file, 0);

    if (m_file.error() != QFile::NoError) {
        m_error = m_file.errorString();
    }
    m_file.close();
    m_closed = true;
    return m_error.isEmpty();
}
