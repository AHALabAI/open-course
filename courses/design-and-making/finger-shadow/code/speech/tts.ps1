# Local installed Windows voices only. Plain text in; WAV bytes in memory out.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voiceList = @($speaker.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'en-*' } | ForEach-Object { @{ name=$_.VoiceInfo.Name; language=$_.VoiceInfo.Culture.Name; gender=$_.VoiceInfo.Gender.ToString() } })
[Console]::WriteLine('{"ready":true}')
while ($null -ne ($line = [Console]::ReadLine())) {
    $request = $null
    $memory = $null
    try {
        if ($line.Length -gt 15000) { throw 'TTS input too long' }
        $request = $line | ConvertFrom-Json
        if ($request.command -eq 'voices') {
            $result = @{ voices=$voiceList; local=$true; engine='Windows System.Speech' }
        } else {
            $text = [string]$request.text
            if ([string]::IsNullOrWhiteSpace($text) -or $text.Length -gt 2000) { throw 'TTS text length invalid' }
            $voiceName = [string]$request.voice
            if (-not ($voiceList | Where-Object { $_.name -eq $voiceName })) { throw 'English voice not installed' }
            $rate = [int]$request.rate
            if ($rate -lt -4 -or $rate -gt 2) { throw 'TTS rate invalid' }
            $speaker.SelectVoice($voiceName)
            $speaker.Rate = $rate
            $memory = New-Object System.IO.MemoryStream
            $speaker.SetOutputToWaveStream($memory)
            $speaker.Speak($text)
            $speaker.SetOutputToNull()
            $result = @{ audio=[Convert]::ToBase64String($memory.ToArray()); mime='audio/wav'; voice=$voiceName; rate=$rate; local=$true; engine='Windows System.Speech' }
        }
        [Console]::WriteLine((@{ id=$request.id; result=$result } | ConvertTo-Json -Compress -Depth 6))
    } catch {
        [Console]::WriteLine((@{ id=$request.id; error='Local English TTS is unavailable. Check the installed Windows speech voices.' } | ConvertTo-Json -Compress))
    } finally {
        if ($memory) { $memory.Dispose() }
        $request = $null
        $line = $null
    }
}
$speaker.Dispose()
