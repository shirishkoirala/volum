import { describe, it, expect } from 'vitest';
import { isArchiveFile, archiveBaseName, archiveFileName } from '../utils/archive';

describe('isArchiveFile', () => {
  it('detects .zip', () => {
    expect(isArchiveFile('archive.zip')).toBe(true);
  });

  it('detects .tar', () => {
    expect(isArchiveFile('archive.tar')).toBe(true);
  });

  it('detects .tar.gz', () => {
    expect(isArchiveFile('archive.tar.gz')).toBe(true);
  });

  it('detects .tgz', () => {
    expect(isArchiveFile('archive.tgz')).toBe(true);
  });

  it('detects case insensitively', () => {
    expect(isArchiveFile('Archive.ZIP')).toBe(true);
    expect(isArchiveFile('Archive.TAR.GZ')).toBe(true);
  });

  it('rejects non-archive files', () => {
    expect(isArchiveFile('readme.txt')).toBe(false);
    expect(isArchiveFile('script.js')).toBe(false);
    expect(isArchiveFile('file.7z')).toBe(false);
    expect(isArchiveFile('file.rar')).toBe(false);
  });
});

describe('archiveBaseName', () => {
  it('strips .zip', () => {
    expect(archiveBaseName('project.zip')).toBe('project');
  });

  it('strips .tar', () => {
    expect(archiveBaseName('project.tar')).toBe('project');
  });

  it('strips .tar.gz', () => {
    expect(archiveBaseName('project.tar.gz')).toBe('project');
  });

  it('strips .tgz', () => {
    expect(archiveBaseName('project.tgz')).toBe('project');
  });

  it('returns "archive" for name with only extension', () => {
    expect(archiveBaseName('.tar.gz')).toBe('archive');
  });

  it('handles case insensitively', () => {
    expect(archiveBaseName('Project.TAR.GZ')).toBe('Project');
  });
});

describe('archiveFileName', () => {
  it('changes tar to zip', () => {
    expect(archiveFileName('foo.tar')).toBe('foo.zip');
  });

  it('changes tar.gz to zip', () => {
    expect(archiveFileName('foo.tar.gz')).toBe('foo.zip');
  });

  it('changes tgz to zip', () => {
    expect(archiveFileName('foo.tgz')).toBe('foo.zip');
  });

  it('keeps zip as zip', () => {
    expect(archiveFileName('foo.zip')).toBe('foo.zip');
  });
});
