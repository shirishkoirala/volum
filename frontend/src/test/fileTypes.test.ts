import { describe, it, expect } from 'vitest';
import {
  isImageExtension,
  isVideoExtension,
  isAudioExtension,
  isTextExtension,
} from '../utils/fileTypes';

describe('isImageExtension', () => {
  it('returns true for common image extensions', () => {
    expect(isImageExtension('photo.jpg')).toBe(true);
    expect(isImageExtension('photo.jpeg')).toBe(true);
    expect(isImageExtension('photo.png')).toBe(true);
    expect(isImageExtension('photo.gif')).toBe(true);
    expect(isImageExtension('photo.webp')).toBe(true);
    expect(isImageExtension('photo.svg')).toBe(true);
    expect(isImageExtension('photo.bmp')).toBe(true);
    expect(isImageExtension('photo.ico')).toBe(true);
    expect(isImageExtension('photo.tiff')).toBe(true);
    expect(isImageExtension('photo.tif')).toBe(true);
    expect(isImageExtension('photo.avif')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(isImageExtension('photo.JPG')).toBe(true);
    expect(isImageExtension('photo.PNG')).toBe(true);
    expect(isImageExtension('photo.Svg')).toBe(true);
  });

  it('returns false for non-image extensions', () => {
    expect(isImageExtension('doc.pdf')).toBe(false);
    expect(isImageExtension('video.mp4')).toBe(false);
    expect(isImageExtension('script.js')).toBe(false);
  });

  it('returns false for name without extension', () => {
    expect(isImageExtension('photo')).toBe(false);
  });
});

describe('isVideoExtension', () => {
  it('returns true for common video extensions', () => {
    expect(isVideoExtension('video.mp4')).toBe(true);
    expect(isVideoExtension('video.mkv')).toBe(true);
    expect(isVideoExtension('video.mov')).toBe(true);
    expect(isVideoExtension('video.avi')).toBe(true);
    expect(isVideoExtension('video.webm')).toBe(true);
    expect(isVideoExtension('video.m4v')).toBe(true);
    expect(isVideoExtension('video.flv')).toBe(true);
    expect(isVideoExtension('video.mpg')).toBe(true);
    expect(isVideoExtension('video.mpeg')).toBe(true);
    expect(isVideoExtension('video.ogv')).toBe(true);
    expect(isVideoExtension('video.wmv')).toBe(true);
  });

  it('returns false for non-video extensions', () => {
    expect(isVideoExtension('photo.jpg')).toBe(false);
    expect(isVideoExtension('audio.mp3')).toBe(false);
  });
});

describe('isAudioExtension', () => {
  it('returns true for common audio extensions', () => {
    expect(isAudioExtension('audio.mp3')).toBe(true);
    expect(isAudioExtension('audio.wav')).toBe(true);
    expect(isAudioExtension('audio.flac')).toBe(true);
    expect(isAudioExtension('audio.ogg')).toBe(true);
    expect(isAudioExtension('audio.m4a')).toBe(true);
    expect(isAudioExtension('audio.aac')).toBe(true);
    expect(isAudioExtension('audio.opus')).toBe(true);
    expect(isAudioExtension('audio.wma')).toBe(true);
  });

  it('returns false for non-audio extensions', () => {
    expect(isAudioExtension('video.mp4')).toBe(false);
    expect(isAudioExtension('doc.pdf')).toBe(false);
  });
});

describe('isTextExtension', () => {
  it('returns true for code extensions', () => {
    expect(isTextExtension('code.ts')).toBe(true);
    expect(isTextExtension('code.tsx')).toBe(true);
    expect(isTextExtension('code.js')).toBe(true);
    expect(isTextExtension('code.jsx')).toBe(true);
    expect(isTextExtension('code.py')).toBe(true);
    expect(isTextExtension('code.go')).toBe(true);
    expect(isTextExtension('code.rs')).toBe(true);
    expect(isTextExtension('code.java')).toBe(true);
    expect(isTextExtension('code.rb')).toBe(true);
    expect(isTextExtension('code.sh')).toBe(true);
    expect(isTextExtension('code.sql')).toBe(true);
    expect(isTextExtension('code.css')).toBe(true);
    expect(isTextExtension('code.html')).toBe(true);
    expect(isTextExtension('code.htm')).toBe(true);
    expect(isTextExtension('code.json')).toBe(true);
    expect(isTextExtension('code.xml')).toBe(true);
    expect(isTextExtension('code.yaml')).toBe(true);
    expect(isTextExtension('code.yml')).toBe(true);
    expect(isTextExtension('code.md')).toBe(true);
    expect(isTextExtension('code.txt')).toBe(true);
    expect(isTextExtension('code.csv')).toBe(true);
    expect(isTextExtension('code.log')).toBe(true);
    expect(isTextExtension('code.env')).toBe(true);
    expect(isTextExtension('code.toml')).toBe(true);
    expect(isTextExtension('code.ini')).toBe(true);
    expect(isTextExtension('code.conf')).toBe(true);
    expect(isTextExtension('code.cfg')).toBe(true);
    expect(isTextExtension('code.properties')).toBe(true);
    expect(isTextExtension('code.php')).toBe(true);
    expect(isTextExtension('code.svg')).toBe(true);
  });

  it('returns false for binary extensions', () => {
    expect(isTextExtension('file.png')).toBe(false);
    expect(isTextExtension('file.pdf')).toBe(false);
    expect(isTextExtension('file.zip')).toBe(false);
    expect(isTextExtension('file.mp4')).toBe(false);
    expect(isTextExtension('file.exe')).toBe(false);
  });
});
